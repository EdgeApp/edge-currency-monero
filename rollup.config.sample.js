import babel from 'rollup-plugin-babel'
const packageJson = require('./package.json')

const babelConf = {
  presets: ['flow']
}

export default {
  entry: 'sample.js',
  external: [
    ...Object.keys(packageJson.dependencies),
    ...Object.keys(packageJson.devDependencies)
  ],
  plugins: [babel(babelConf)],

  targets: [
    {
      dest: 'sample.out.js',
      format: 'cjs',
      sourceMap: true
    }
  ]
}
