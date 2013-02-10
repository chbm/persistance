
var assert = require('assert')
,		vows = require('vows')
,		fs = require('fs')
,		Persistance = require('../');

'use strict';

['sqlite3', 'memory', 'leveldb' ].forEach(function (st) {
	vows.describe(st+' tests').addBatch({
		'a store': {
			topic: function () {
				var vowsthis = this;
				fs.readdir('/tmp/teststore/', function (err, data) {
					if (err) {
						fs.unlink('/tmp/teststore', function (err) {
							Persistance.make({dbtype: st, dbname: '/tmp/teststore'}, vowsthis.callback);
						});
					} else if (data) {
						data.forEach(function (x) {
							fs.unlinkSync('/tmp/teststore/'+x);
						});
						fs.rmdir('/tmp/teststore', function (err) {
							Persistance.make({dbtype: st, dbname: '/tmp/teststore'}, vowsthis.callback);
						});
					}
				});
			},
			'is a object': function (err, store) {
				assert.isNull(err);
				assert.isObject(store);
			},
			'which has define': function (err, store) {
				assert.isNull(err);
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
					'topic': function (foo) {
						return foo.create();
					},
					'which can be saved': function (obj) {
						assert.isFunction(obj.save);
					},
					'and is initialized with defaults': function (obj) {
						assert.equal(obj.i, 1);
						assert.equal(obj.s, 'helo');
						assert.deepEqual(obj.a, []);
						assert.deepEqual(obj.o, {});
					}
				},

				'if you create a named object': {
					'topic': function (foo) {
						var vcb = this.callback;
						foo.create('xpto').save(function () {
							foo.get('xpto', vcb);
						});
					},
					'you can get it back': function (err, data) {
						assert.isNull(err);
						assert.isObject(data);
						assert.isObject(data.xpto);
					}
				},

				'you can search for it': {
					'topic': function (foo) {
						var vcb = this.callback;
						foo.create('zing', {i : 2}).save(function () {
							foo.search({i: 2}, vcb);
						});
					},
					'and get it back': function (err, data) {
						assert.isNull(err);
						assert.isObject(data);
						assert.isObject(data.zing);
					}
				},

				'but after you delete it': {
					'topic': function (foo) {
						var vcb = this.callback;
						foo.create('zzz').save(function (err, obj) {
							obj.delete(function (err) {
								foo.get('zzz', vcb);
							});
						});
					},
					'you cant get it back': function (err, data) {
						assert.isNull(err);
						assert.isObject(data);
						assert.isEmpty(data);
					}
				},

				'if you have some objects starting with same prefix': {
					'topic': function (foo) {
						var vcb = this.callback;
						foo.create('qwerta').save(function (err, obj) {
							foo.create('qwertb').save(function (err, obj) {
								debugger
								foo.startingWith('qwert', vcb);
							});
						});
					},
					'you can get some by prefix': function (err, data) {
						debugger
						assert.isNull(err);
						assert.isObject(data);
						assert.isObject(data.qwerta);
						assert.isObject(data.qwertb);
					}
				}
			}

		}

	}).export(module);
});
