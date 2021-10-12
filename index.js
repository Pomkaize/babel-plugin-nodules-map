const NODULES_MAP_INNER_METHOD_NAME = '_add';

const nodulesMapIdentifier = {
    name: 'NodulesMap',
}

const nodulesMapAddMethodIdentifier = {
    name: 'add',
}

const requireIdentifier = {
    name: 'require'
}

const isArgumentValidRequireIdentifierReference = state => {
    const { t, path } = state;
    if (! path) {
        return false;
    }

    return t.isCallExpression(path.node) && t.isIdentifier(path.node.callee, requireIdentifier) && t.isStringLiteral(path.node.arguments[0]);
}

const isArgumentIdentifier = state => {
    const { t, path } = state;
    if (! path) {
        return false;
    }

    return t.isIdentifier(path.node);
}

const isNodulesMapDeclaration = (t, declaration) => {
    return t.isNewExpression(declaration.init) && t.isIdentifier(declaration.init.callee, nodulesMapIdentifier)
}

const isRightImportDeclaration = (t, declaration) => {
    return t.isImportDeclaration(declaration.node) && t.isStringLiteral(declaration.node.source);
}

const isRightVariableDeclaration = (t, declaration) => {
    return t.isVariableDeclaration(declaration.node);
}

const isRightImportVariableSpecifier = (t, specifier) => {
    return (t.isImportSpecifier(specifier) || t.isImportDefaultSpecifier(specifier)) && t.isIdentifier(specifier.local)
}

const isRightVariableRequireDeclarator = (t, declarator) => {
    return t.isVariableDeclarator(declarator)
        && t.isCallExpression(declarator.init)
        && t.isIdentifier(declarator.init.callee, requireIdentifier)
        && t.isStringLiteral(declarator.init.arguments[0])
}

// определяем, что вызов метода .add  был на экземпляре NodulesMap
const isNodulesMapInstanceNode = (state) => {
    const { t, path } = state;

    if (! path) {
        return false;
    }

    const { node } = path;

    if (t.isNewExpression(node)) {
        return t.isIdentifier(node.callee, nodulesMapIdentifier);
    }

    if (t.isIdentifier(node)) {
        const declaration = getIdentifierPathDeclarationReference(state);

        if (!t.isVariableDeclaration(declaration.node)) {
            return false;
        }

        // смотрим, что в месте декларации есть нужная переменная
        return declaration.node.declarations.some(declaration => declaration.id.name === path.node.name && isNodulesMapDeclaration(t, declaration))
    }

    return false;
}

// хелпер, позволяющий по Identifier path найти объявление, вернет undefined или VariableDeclaration или ImportDeclaration
const getIdentifierPathDeclarationReference = state => {
    const { t, path } = state;
    const { node } = path;
    const { name } = node;

    if (!t.isIdentifier(node)) {
        return;
    }
    // пытаемся найти переменную в текущей области видимости
    let identifierPath = path.scope.bindings[name]?.path;

    // поднимаемся вверх, пока не найдем переменную в области видимости
    if (! identifierPath) {
        const pathWithIdentifierPath = path.findParent(path => Boolean(path.scope.bindings[name]));

        if (pathWithIdentifierPath) {
            identifierPath = pathWithIdentifierPath.scope.bindings[name].path
        }
    }

    if (! identifierPath) {
        return;
    }

    return identifierPath.parentPath;
}

const firstMemberExpressionNotCallExpressionVisitor = {
    MemberExpression(path, state) {
        const { t } = state;

        if (! t.isIdentifier(path.node.property, nodulesMapAddMethodIdentifier)) {
            return;
        }

        if (!t.isCallExpression(path.node.object)) {
            state.path = path.get('object');

            // намеренно обрываем дальнейший поиск, так как нам нужен только самый первый узел
            path.stop();
        }
    }
}

// идея плагина
// находим все вызовы .add(module) в исходном коде
// проверяем где они были вызваны, в нашем случае NoduleMap
// достаем из аргументов в вызове .add(module) метода информацию о том где расположен модуль - nodulesMapKey
// заменяем вызовы .add() на внутренний вызов ._add(nodulesMapKey, module)
module.exports = function plugin({ types: t }) {
    return {
        visitor: {
            // получаем все вызовы
            CallExpression(path) {
                if (! t.isMemberExpression(path.node.callee)) {
                    return;
                }

                const memberExpressionState = { path: null, t };

                // цепочка .add().add().add() порождает рекурсивные CallExpression MemberExpression, и только в самом конце
                // можно найти Identifier, к которому относятся вызовы, запоминаем его в memberExpressionState.path
                path.traverse(firstMemberExpressionNotCallExpressionVisitor, memberExpressionState);

                if (! isNodulesMapInstanceNode(memberExpressionState)) {
                    return;
                }

                const argument = path.get('arguments.0');

                const argumentState = { path: argument, t }

                // в случае, если переданный аргумент в .add это вызов require напрямую
                if (isArgumentValidRequireIdentifierReference(argumentState)) {
                    const nodulesMapKey = argument.node.arguments[0].value;

                    path.node.arguments = [t.stringLiteral(nodulesMapKey), argument.node]
                    path.node.callee.property.name = NODULES_MAP_INNER_METHOD_NAME;

                    return;
                }

                // в случае, если переданный аргумент это переменная
                if (isArgumentIdentifier(argumentState)) {
                    const declaration = getIdentifierPathDeclarationReference(argumentState);

                    // аргумент - это декларация переменной через require
                    if (isRightVariableDeclaration(t, declaration)) {
                        const variableDeclarator = declaration.node.declarations.find(declaration => declaration.id.name === argument.node.name);

                        // перепроверяем конкретную декларацию переменной по параметрам
                        if (!isRightVariableRequireDeclarator(t, variableDeclarator)) {
                            return;
                        }

                        const nodulesMapKey = variableDeclarator.init.arguments[0].value;

                        path.node.arguments = [t.stringLiteral(nodulesMapKey), argument.node]
                        path.node.callee.property.name = NODULES_MAP_INNER_METHOD_NAME;
                    }

                    // аргумент - это импорт es6 модуля
                    if (isRightImportDeclaration(t, declaration)) {
                        const importSpecifier = declaration.node.specifiers.find(specifier => specifier.local.name === argument.node.name);

                        // перепроверяем конкретный импорт по параметрам
                        if (!isRightImportVariableSpecifier(t, importSpecifier)) {
                            return;
                        }

                        const nodulesMapKey = declaration.node.source.value;

                        path.node.arguments = [t.stringLiteral(nodulesMapKey), argument.node]
                        path.node.callee.property.name = NODULES_MAP_INNER_METHOD_NAME;
                    }
                }
            }
        },
    }
};
