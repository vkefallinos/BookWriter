var path = require('path');

module.exports = {
  entry: [
    path.resolve(__dirname, 'index.js')
  ],
  output: {
    path: path.resolve(__dirname, 'public', 'js'),
    filename: 'bundle.js'
  },
  module: {
    loaders: [
      {
        test: /\.js$/,
        loader: 'babel',
        exclude: /node_modules/
      }
    ]
  }
}
