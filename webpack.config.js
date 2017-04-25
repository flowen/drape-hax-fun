const webpack = require('webpack');
const nodeEnv = process.env.NODE_ENV || 'production';

module.exports = {
  devtool: 'source-map',
  entry: {
    filename: './src/index.js',
  },
  output: {
    filename: './dist/index.min.js'
  },
  module: {
    loaders: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        loader: 'babel-loader',
        query: {
          presets: [
              ["es2015", { "modules": false }]
            ]
        }
      },
      // This applies the loader to all of your dependencies,
      // and not any of the source files in your project:
      // excluding browser-media-mime-type giving errors
      {
        test: /node_modules/,
        exclude: /browser-media-mime-type/,
        loader: 'ify-loader'
      }
    ]
  },
  plugins: [
    new webpack.optimize.UglifyJsPlugin({
      compress: { warnings: false },
      output: { comments: false },
      sourceMap: true
    }),
    new webpack.DefinePlugin({
      'proccess.env': { NODE_ENV: JSON.stringify(nodeEnv)}
    })
  ]
}