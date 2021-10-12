const fs = require('fs');
const babel = require('@babel/core');

const plugin = require('../index');

const sourceCode = fs.readFileSync('./source.js', { encoding: 'utf8' });

const { code } = babel.transform(sourceCode, { plugins: [ plugin ] });

fs.writeFileSync('./transformed.js', code, { encoding: 'utf8' });
