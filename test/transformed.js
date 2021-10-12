const {
  NodulesMap
} = require('../index'); // работаем с картой, map положили в переменную


const map = new NodulesMap();

map._add("./a", require('./a'))._add("./b", require('./b')); // работа с картой без перекладывания в переменную


new NodulesMap()._add("./c", require('./c')); // путь для map положили в переменную


const module = require('./p');

map._add("./p", module); // вложенный scope для map


function test1() {
  map._add("c", require('c'));
} // es6 импорты


import a from './moduleA';

new NodulesMap()._add("./moduleA", a); // es6 импорты


import { b } from './moduleB';

new NodulesMap()._add("./moduleB", b); // не NodulesMap экземпляр вызывает add метод


new NotNodulesMapTest().add(require('./d')); // не NodulesMap экземпляр вызывает add метод через переменную

const test = new NotNodulesMapTest();
test.add(require('./dsadas'));