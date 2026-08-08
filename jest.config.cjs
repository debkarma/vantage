/** @type {import('jest').Config} */
module.exports = {
  transform: {
    '\\.ts$': 'esbuild-jest',
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
