/*
 * 
 */
var uuid = require('node-uuid')
  , util = require('util')
	, events = require('events');



function is_object(o) {
	return (o && (typeof o === 'object'));
}

function is_function(o) {
	return (o && (typeof o === 'function'));
}

function ensure_members (o, m) {
	if(!is_object(o)) return false;
	if(!m || !m.forEach) return false;
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

function Persistance (options) {
	var self = this;

	if(!is_object(options) || !ensure_members(options, ['dbtype', 'dbname'])) throw Error('persistance needs options');

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

Persistance.prototype.inform = function (obj, options) {
	console.log('informing ', obj, ' about ', options);
	var self = this;
	if(!is_object(obj)) throw Error('can only persist objects');
	if(typeof options !== 'object') options = {};

	var schema = obj._persistschema || {};
	Object.defineProperty(obj, '_persistschema', {
		value: schema,
		enumerable: false
	});

	for (var k in options) {
		schema[k] = {
			type: getType(options[k]),
			default: options[k]
		};
		obj[k] = options[k];
	}


	return obj;
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

	self.inform(baseObj, schema);
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

		self.bag[makeKey(obj)] = obj;

		if(is_function(cb)) cb(null, obj);
		return obj;
	}

	baseObj.delete = function (name) {
		self.forget(this, name);
	}

	return baseObj;
}

exports.Persistance = Persistance;

