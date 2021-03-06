/*
 *
 */

var levelup = require('levelup')
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

function makeIndex(obj, key, val, name) {
	if (val === undefined) {
		val = obj[key] !== undefined ? obj[key] : '';
	}
	if (name === undefined) {
		name = obj._persistname || '';
	}
	return new Buffer('\n' + obj._persisttype + '\0' + key + '\0' + val + '\0' + name);
}

function nameFromKey(key) {
	return key.split('\\')[1];
}

function typeFromKey (key) {
	return key.split('\\')[0];
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
				// XXX make this a batch
				self.level.put(makeIndex(obj, k, undefined, undefined), '');
				self.level.put(makeIndex(obj, k, obj[k], ''), '');
				self.level.put(makeIndex(obj, k), '', function (err) {
					if (err) {
						return cb(err, undefined);
					}
					insKeys(kk);
				});
			}
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
				if (err && err.name !== 'NotFoundError') {
					return cb(err, undefined);
				}
				if (val) {
					stuff[key] = type.create(key, JSON.parse(val.toString()));
				}
				return cb(undefined, stuff);
			});
		} else {
			(function () {
				var rs
				, stuff = {};

				function gotEverything() {
					cb(undefined, stuff);
				}

				rs = self.level.readStream()
				.on('data', function (data) {
					if (data.value.length > 2) {
						// not an internal marker
						stuff[data.key] = JSON.parse(data.value.toString());
					};
				})
				.on('error', function (err) {
					cb(err, undefined);
				})
				.on('end', function () {
					gotEverything();
				})
				.on('close', function () {
				});
			}) ();
		}			
	},

	forget: function (obj, cb) {
		var self = this;

		if (!is_function(cb)) {
			cb = function () {};
		}

		self.level.del(makeKey(obj), function (err) {
			var k;
			if (err) {
				return cb(err, undefined);
			}

			for (k in obj._persistschema) {
				self.level.del(makeIndex(obj, k));
			}
			if (obj.hasOwnProperty('_persisttype')) {
				delete obj._persisttype;
			}
			if (obj.hasOwnProperty('_persistname')) {
				delete obj._persistname;
			}

			return cb(undefined, undefined);
		});
	},

	search: function (type, conditions, cb) {
		var zkeys = {}
		, stuff = {}
		, self = this
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

		function searchKeys (condkeys) {
			var rs
			, k
			, thekey = condkeys.pop();

			if(thekey === undefined) {
				return mergeAndGet();
			}

			thekey = thekey.toString();
			rs = self.level.readStream({start: thekey})
			.on('data', function (data) {
				if(thekey === data.key.slice(0, thekey.length)) {
					k = data.key.slice(thekey.length);
					if(k.length > 0) {
						if(!(k in zkeys)) zkeys[k] = 0;
						zkeys[k] += 1;
					}
				} else {
					rs.destroy();
					searchKeys(condkeys);
				}
			})
			.on('error', function (err) {
				rs.destroy();
				return cb(err, undefined);
			})
			.on('end', function () {
				searchKeys(condkeys);				
			})
			.on('close', function () {
				searchKeys(condkeys);
			});

		}

		function getObjs (names) {
			var name = names.pop();
			if(name === undefined) {
				return cb(undefined, stuff);
			}

			self.level.get(makeKey(type, name), function (err, data) {
				if(err) {
					return cb(err, undefined);
				}
				if (data !== undefined) {
					stuff[name] = type.create(name, JSON.parse(data.toString()));	
				}
				getObjs(names);
			});
		}

		function mergeAndGet () {
			var k
			, marker = Object.keys(conditions).length;

			for(k in zkeys)	{
				if (zkeys[k] !== marker) {
					delete zkeys[k];
				}
			}

			getObjs(Object.keys(zkeys));
		}

		searchKeys(Object.keys(conditions).map(function (x) {return makeIndex(type, x, conditions[x], '')}));
	},

	startingWith: function (type, keyPrefix, cb) {
		var self = this
		, rs
		, thekey = makeKey(type, keyPrefix)
		, stuff = {};
		rs = self.level.readStream({start: thekey})
			.on('data', function (data) {
				var k;
				if(thekey === data.key.slice(0, thekey.length)) {
					k = nameFromKey(data.key);
					stuff[k] = type.create(k, JSON.parse(data.value.toString()));
				} else {
					rs.destroy();
				}
			})
			.on('error', function (err) {
			})
			.on('end', function () {
				return cb(undefined, stuff);
			})
			.on('close', function () {
			});

	},
}

store.open = function (dbname, fn) {
	var self = Object.create(Backend);

	if (!is_function(fn)) {
		fn = function () {};
	}

	levelup(dbname, { create_if_missing: true, encoding: 'utf8' },	function(err, data) {
		if (err) {
			return fn(err, undefined);
		}
		self.level = data;
		return fn(undefined, self);
	});
}


