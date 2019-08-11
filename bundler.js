const fs = require('fs')
const path = require('path')
const parser = require('@babel/parser')
const { transformFromAst } = require('@babel/core')
const traverse = require('@babel/traverse').default
const md5 = require('md5')
const rm = require('rimraf')
const bundleConfig = require('./bundle.config')

const entry = bundleConfig.entry
const placeholder = ['name', 'ext', 'contenthash']

const parseFileName = (entry, outPath, code) => {
  const parseFileName = path.parse(entry)
  const handle = {
    name: parseFileName.name,
    ext: parseFileName.ext.split('.')[1],
    contenthash: md5(code)
  }
  let newFileName = outPath.replace(/\w+/g, match => {
    return handle[match]
  })
  newFileName = newFileName.replace(/[\[\]]/g, '')
  return newFileName
}

const analyserModule = entry => {
  try {
    const dependencies = {}
    const content = fs.readFileSync(entry, 'utf8')
    const ast = parser.parse(content, {
      sourceType: 'module'
    })
    traverse(ast, {
      ImportDeclaration({ node }) {
        const dirname = path.dirname(entry)
        const entryUrl = node.source.value
        dependencies[entryUrl] = path.join(dirname, entryUrl)
      }
    })
    const { code } = transformFromAst(ast, null, {
      presets: ['@babel/preset-env']
    })
    return {
      filename: entry,
      dependencies,
      code
    }
  } catch(err) {
    throw err
  }
}

const generateModuleGraph = entry => {
  const entryModule = analyserModule(entry)
  const allModule = [entryModule]
  const moduleGraph = {}
  for(let i = 0; i < allModule.length; i++) {
    let dependencies = allModule[i].dependencies
    for(let dependency in dependencies) {
      allModule.push(analyserModule(dependencies[dependency]))
    }
  }
  allModule.forEach(item => {
    moduleGraph[item.filename] = {
      code: item.code,
      dependencies: item.dependencies
    }
  })
  return moduleGraph
}

const generateCode = entry => {
  const moduleGraph = JSON.stringify(generateModuleGraph(entry))
  const code = 
`(function(graph){
  function require(module){
    function myRequire(path){
      return require(graph[module].dependencies[path]);
    }
    var exports = {};
    (function(require, exports, code){
      eval(code)
    })(myRequire, exports, graph[module].code);
    return exports;
  }
  require('${entry}')
})(${moduleGraph});`

  return code
}

rm(bundleConfig.output.path, err => {
  if (err) throw err;
  let code = generateCode(entry)
  let isExists = fs.existsSync(bundleConfig.output.path)
  if (!isExists) {
    fs.mkdirSync(bundleConfig.output.path)
  }
  let filename
  if (bundleConfig.output.filename.search(/\]/)) {
    filename = parseFileName(entry, bundleConfig.output.filename, JSON.stringify(generateModuleGraph(entry)))
  } else {
    filename = bundleConfig.output.filename
  }
  fs.writeFileSync('dist/index.html', fs.readFileSync('public/index.html', 'utf8'))
  fs.writeFileSync(
    path.join(bundleConfig.output.path, filename),
    code
  )
})



// console.log(generateCode(entry));


