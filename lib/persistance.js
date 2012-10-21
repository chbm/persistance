/*
 * 
 */
var Sqlite3 = require('sqlite3')
	, uuid = require('node-uuid')
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

	self.dbtype = 'sqlite3';
	self.dbname = options.dbname;
	self.bag = {};
	self.store = new Sqlite3.Database(options.dbname, function(err) {
		if(err) throw Error(err)
		self.store.exec('create table if not exists Persistance (name text, type text, json text, primary key(name,type))');
	});

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

Persistance.prototype.persist = function(obj, cb) {
	var self = this;
	if(!is_object(obj) || !obj._persisttype) {
		console.log(obj);
		throw Error('cant persist something ive not been informed about');
	}
	self.store.run('insert or replace into Persistance (name, type, json) values (?,?,?)'
								 , [obj._persistname, obj._persisttype, JSON.stringify(obj)]
								, function (err) {
										if(is_function(cb)) {
											return cb(err, obj);
										} else {
											self.emit('saved', err, obj);
										}
									}); 

	self.bag[makeKey(obj)] = obj;
}

Persistance.prototype.persistall = function () {
	var self = this;

	for(var n in self.bag) {
		self.persist(self.bag[n]);
	}
}

Persistance.prototype.restore = function(type, key, cb) {
	var self = this, typename;

	if(!is_object(type) && !is_function(type)) throw Error('need a type to restore');
	if(!type._persisttype) throw Error('not informed about '+type);

	key = key || '%';
	self.store.all('select name, json from Persistance where type = ? and name like ?', [type._persisttype, key], function(err, rows) {
		var stuff = {};
		if(err) {	
			throw err;
		} 
		rows.forEach(function(x) {
			var s = JSON.parse(x.json);
			stuff[x.name] = type.create(x.name, s);
		});
		if(cb && is_function(cb)) {
			cb(err, stuff);	
		} else {
			self.emit(type._persisttype, stuff);
		}
	});
	
	return self;
}

Persistance.prototype.clearHandlers = function(type) {
	var self = this;

	if(!is_object(type) && !is_function(type)) throw Error('need a type to restore');
	if(!type._persisttype) throw Error('not informed about '+type);
	self.removeAllListeners(type._persisttype);

	return self;
}

Persistance.prototype.forget = function(obj) {
	var self = this;
	if(!is_object(obj)) throw  Error('can only forget objects');

	self.store.run('delete from Persistance where type = ? and name = ?', [obj._persisttype, obj._persistname]);
	delete self.bag[obj._persisttype+obj._persistname]; 
	if(obj.hasOwnProperty('_persisttype')) delete obj._persisttype;
	if(obj.hasOwnProperty('_persistname')) delete obj._persistname;
}

exports.Persistance = Persistance;

