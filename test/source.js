const { NodulesMap } = require('../index');

// работаем с картой, map положили в переменную
const map = new NodulesMap();

map
    .add(require('./a'))
    .add(require('./b'))

// работа с картой без перекладывания в переменную
new NodulesMap()
    .add(require('./c'))

// путь для map положили в переменную
const module = require('./p');

map.add(module);

// вложенный scope для map
function test1() {
    map.add(require('c'))
}

// es6 импорты
import a from './moduleA';

new NodulesMap()
    .add(a)

// es6 импорты
import { b } from './moduleB';

new NodulesMap()
    .add(b)

// не NodulesMap экземпляр вызывает add метод
new NotNodulesMapTest()
    .add(require('./d'))

// не NodulesMap экземпляр вызывает add метод через переменную
const test = new NotNodulesMapTest();

test.add(require('./dsadas'))

