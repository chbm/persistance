
var assert = require('assert')
,		vows = require('vows')
,		Persistance = require('../').Persistance;

'use strict';

vows.describe('basic tests').addBatch({
	'a store': {
		topic: new Persistance({dbtype: 'sqlite3', dbname: '/tmp/teststore'}),
		'is a object': function (store) {
			assert.isObject(store);
		},
		'which has define': function (store) {
			assert.isFunction(store.define);
		},
		'a defined object': {
			topic: function (store) {
				return store.define('foo', {
					i: 1,
					s: 'helo',
					a: [],
					o: {}
				});
			},
			'is a object': function (foo) {
				assert.isObject(foo);
			},
			'which has a schema': function (foo) {
				console.log(foo);
				assert.isObject(foo._persistschema);
			},
			'and a type': function (foo) {
				assert.include(foo._persistschema, '_persisttype');
			},
			'which is foo': function (foo) {
				assert.equal(foo._persistschema._persisttype, 'foo');
			},
			'and a create function': function (foo) {
				assert.isFunction(foo.create);
			},
			'which returns an object': {
				'topic': function (foo) { return foo.create(); },
				'which can be saved': function (obj) {
					assert.isFunction(obj.save);
				},
				'and is initialized with defaults': function (obj) {
					assert.equal(obj.i, 1);
					assert.equal(obj.s, 'helo');
					assert.deepEqual(obj.a, []);
					assert.deepEqual(obj.o, {});
				}
			}

		}


	}
}).export(module);

