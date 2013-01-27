/*
 *
 */

var leveldb = require('leveldb')
	, uuid = require('node-uuid')
	, util = require('util');

"use strict";


function is_object(o) {
	return (o && (typeof o === 'object'));
}

function is_function(o) {
	return (o && (typeof o === 'function'));
}

function makeKey(obj, key) {
	if (key === undefined) {
		key = obj._persistname;
	}
	return obj._persisttype + '\\' + key;
}

function makeIndex (obj, key, val, name) {
	if (val === undefined) {
		val = obj[key] !== undefined ? obj[key] : '';
	}
	if (name === undefined) {
		name = obj._persistname || '';
	}
	return new Buffer('KKKKKK' + obj._persisttype + '\0' + key + '\0' + val + '\0' + name);
}

var store = exports.store = {};


var Backend = {
	persist: function (obj, cb) {
		var self = this;

		self.level.put(makeKey(obj), JSON.stringify(obj), function (err) {
			if (err) {
				return cb(err, undefined);
			}
			function insKeys(kk) {
				var k = kk.pop();
				if (k === undefined) {
					return cb(undefined, obj);
				}
				self.level.put(makeIndex(obj, k, undefined, undefined), '');
				self.level.put(makeIndex(obj, k, obj[k]), '');
				self.level.put(makeIndex(obj, k), makeKey(obj), function (err) {
					if (err) {
						return cb(err, undefined);
					}
					insKeys(kk);
				});
			};
			insKeys(Object.keys(obj._persistschema).filter(function (x) {return obj._persistschema[x].searchable}));
		});
	},

	restore: function (type, key, cb) {
		var self = this
			, stuff = {};

		if (!is_function(cb)) {
			cb = function () {};
		}
		if (key !== undefined) {
			self.level.get(makeKey(type, key), function (err, val) {
				if (err) {
						return cb(err, undefined);
					}
					if (!val) {
						return cb(new Error('key not found'), undefined);
					}
					stuff[key] = type.create(key, JSON.parse(val.toString()));
			});
		} else {
			(function () {
				var idx = 0
				, testKey = makeKey(type, '');

				self.level.iterator(function (err, it) {
					it.seekToFirst(function () {
						var val
						, key;
						while (it.valid()) {
							key = it.key().toString('utf-8');
							if(key.slice(0, testKey.length) === testKey) {
								val = it.value().toString();
								key = key.slice(testKey.length);
								stuff[key] = type.create(key, JSON.parse(val));
							}
						}
					});
				});
			})();
		}						

		return cb(undefined, stuff);
	},

	forget: function (obj) {
		var self = this;

		self.level.del(makeKey(obj), function (err) {
			// nothing
		});
	},

	search: function (obj, conditions) {
		var zkeys = {}
		, stuff = {}
		, self = this
		, testKey
		, it
		, k
		, names
		, name
		, val;

		function bufcmp (sb, lb) {
			var i;
			for (i = 0; i < sb.length; i++) {
				if(sb[i] !== lb[i]) {
					return false;
				}
			}
			return true;
		}

		for(k in conditions) { // XXX needs rewrite for iterator api
			it = self.level.newIterator();
			testKey = makeIndex(obj, k, obj[k]);
			it.seek(testKey);
			while(it.valid() && testKey) {
				if(bufcmp(testKey, it.key())) {
					stuff[it.value().toString('utf-8')] += 1;
				} else {
					testKey = undefined;
				}
			}
		}

		testKey = Object.keys(conditions).length;

		function getObjs (names) {
			var name = names.pop();
			if(name === undefined) {
				return cb(undefined, stuff);
			}

			if(stuff[name] !== testKey) {
				delete stuff[name];
				return getObjs(names);
			} 

			self.level.get(makeKey(obj, name), (function (names) {
				return function (err, data) {
					if(err || data === undefined) {
						delete stuff[name];
						return getObjs(names);
					}
					stuff[name] = type.create(name, JSON.parse(it.value().toString('utf-8')));	
					getObjs(names);
				}
			}) (names) );
		}
		getObjs(Object.keys(stuff));
	}
};

store.open = function (dbname, fn) {
	var self = Object.create(Backend);

	if (!is_function(fn)) {
		fn = function () {};
	}

	leveldb.open(dbname, { create_if_missing: true },	function(err, data) {
		if (err) {
			return fn(err, undefined);
		}
		self.level = data;
		return fn(undefined, self);
	});
}


