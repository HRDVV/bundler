module.exports = {
  entry: './src/index.js',
  output: {
    path: './dist',
    filename: '[name].[contenthash].[ext]'
  }
}