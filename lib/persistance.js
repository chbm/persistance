/*
 * 
 */
var uuid = require('node-uuid')
, util = require('util')
, events = require('events');

'use strict';

function is_object(o) {
	return (o && (typeof o === 'object'));
}

function is_function(o) {
	return (o && (typeof o === 'function'));
}

function ensure_members(o, m) {
	if (!is_object(o)) return false;
	if (!m || !m.forEach) return false;
	m.forEach(function(x) {if(!o.hasOwnProperty(x)) return false;});

	return true;
}

function find_name (o) {
	var name = '';

	function get_func_name(t) {
		var stuff = /function\s+(\w+)/.exec(t);
		if(stuff) {
			return stuff[1];
		} else {
			return false;
		}
	}

	if(!is_object(o) && !is_function(o)) return false;

	name = get_func_name(o.constructor.toString());
	if(name) {
		if(name === 'Function') {
			name = get_func_name(o.toString());
		}
	}
	return name;
}

function slowSearch(conditions, cb) {
	var self = this, kk, k;

	if (!is_object(conditions)) {
		return cb(new Error('conditions needs to be an object'), undefined);
	}

	kk = Object.keys(conditions);

	self.get(undefined, function (err, data) {
		// XXX this gets everything into one array. bad mojo

		if (err) {
			return cb(err, undefined);
		}
		for (k in data) {
			if (!kk.every(function (x) { return data[k][x] === conditions[x]; }) ) {
				delete data[k];
			}
		};

		cb(undefined, data);
	});
}

function Persistance (options) {
	var self = this;

	if (!is_object(options) || !ensure_members(options, ['dbtype', 'dbname'])) throw Error('persistance needs options');

	if(options.dbtype !== 'sqlite3') throw Error('only sqlite3 is supported now');

	var sqlite3 = require('./sqlite3').sqlite3;
	for(var k in sqlite3) {
		self[k] = sqlite3[k].bind(self);
	}
	self.dbtype = 'sqlite3';
	self.dbname = options.dbname;
	self.store = sqlite3.openStore(self.dbname, console.log);
	self.bag = {};

	return self;
}

util.inherits(Persistance, events.EventEmitter);

function getType (arg) {
	var type = typeof arg;
	if(type === 'object') {
		if(Array.isArray(arg)) {
			type = 'array';
		}
	}
	return type;
}


function validateValue (k, schema, values) {
	if(schema[k]) {
		return schema[k].type === getType(values[k]);
	} else {
		return true;
	}
}

function makeKey (obj) {
	return obj._persisttype + '/' + obj._persistname;
}

Persistance.prototype.define = function(type, schema) {

	var self = this; //Object.create(new events.EventEmitter);
	var baseObj = {};

	if(!is_object(schema)) {
		return undefined;
	}

	Object.defineProperty(baseObj, '_persistschema', {
		value: {},
		enumerable: false
	});

	for (var k in schema) {
		baseObj._persistschema[k] = {
			type: getType(schema[k]),
			default: schema[k]
		};
		baseObj[k] = schema[k];
	}

	Object.defineProperty(baseObj, '_persisttype', {value: type, enumerable: false, writable: false});
	Object.defineProperty(baseObj._persistschema, '_persisttype', {value: type, enumerable: false, writable: false});

	baseObj.save = baseObj.update = function (cb) {
		self.persist(this, cb)
	}

	baseObj.get = function (name, cb) {
		self.restore(this, name, cb);
	};

	baseObj.create = function (name, values, cb) {
		var obj = Object.create(baseObj);
		if(typeof values !== 'object') values = {};
		// TODO check if the name already exists
		obj._persistname = name || uuid.v4();

		for (var k in obj._persistschema) {
			obj[k] = validateValue(k, obj._persistschema, values) ? values[k] : obj._persistschema[k].default;
		}

		if(is_function(cb)) cb(null, obj);
		return obj;
	}

	baseObj.delete = function (name) {
		self.forget(this, name);
	}

	if(is_function(self.store.search)) {
		baseObj.search = function (conditions, cb) {
			self.search(this, conditions, cb);
		}
	} else {
		baseObj.search = slowSearch.bind(baseObj);
	}

	if(is_function(self.store.define)) {
		self.store.define(baseObj);
	}

	return baseObj;
}

exports.Persistance = Persistance;

