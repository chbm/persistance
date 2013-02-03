/*
 * 
 */
var Sqlite3 = require('sqlite3')
	, uuid = require('node-uuid')
  , util = require('util')
	, events = require('events');

// ---- SQLITE

"use strict";

function is_object(o) {
	return (o && (typeof o === 'object'));
}

function is_function(o) {
	return (o && (typeof o === 'function'));
}

var Pers = Object.create(new events.EventEmitter());

Pers.persist = function(obj, cb) {
	var self = this;

	if(!is_object(obj) || !obj._persisttype) {
		return cb(new  Error('cant persist something ive not been informed about'), undefined);
	}
	if (!is_function(cb)) {
		cb = function () {};
	}
	self.sql3.run('insert or replace into Persistance (name, type, json) values (?,?,?)' , [obj._persistname, obj._persisttype, JSON.stringify(obj)], function (err) {
		if (err) {
			return cb(err, undefined);
		}
		self.sql3.serialize(function () {
			var x;
			for (x in obj._persistschema) {
				if (obj._persistschema[x].searchable) {
					self.sql3.run('insert or replace into Persistance_' + obj._persisttype + ' (name, field, value) values (?,?,?)', [obj._persistname, x, obj[x]], function (err) {
						if (err) {
							console.trace('oops ' + err);
							cb(err, undefined);
							cb = function () {}; // does this work ? who knows ? 
						}
					});
				}
			}
			return cb(undefined, obj);
		});
	});
}

function processRows(err, rows, type, cb) {
	var stuff = {};
	if(err) {	
		return cb(err, undefined);
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
}

Pers.restore = function(type, key, cb) {
	var self = this, typename;

	if(!is_object(type) && !is_function(type)) throw Error('need a type to restore');
	if(!type._persisttype) throw Error('not informed about '+type);

	key = key || '%';
	self.sql3.all('select name, json from Persistance where type = ? and name like ?', [type._persisttype, key], function (err, rows) {
		processRows(err, rows, type, cb);
	}
							 );

							 return self;
}

Pers.forget = function(obj) {
	var self = this;
	if(!is_object(obj)) throw  Error('can only forget objects');

	self.sql3.run('delete from Persistance where type = ? and name = ?', [obj._persisttype, obj._persistname]);
	if(obj.hasOwnProperty('_persisttype')) delete obj._persisttype;
	if(obj.hasOwnProperty('_persistname')) delete obj._persistname;
}


Pers.define = function (obj) {
	var self = this;

	if(Object.keys(obj._persistschema).some(function (x) {return obj._persistschema[x].searchable})) {
		self.sql3.exec('create table if not exists Persistance_' + obj._persisttype + ' (name text, field text, value text, primary key(name,field))', function (err)  {if (err) console.trace('define', err)});
		self.sql3.exec('create index if not exists field on Persistance_' + obj._persisttype + '(field)');
		self.sql3.exec('create index if not exists value on Persistance_' + obj._persisttype + '(value)');
	}
}

Pers.search = function (obj, conditions, cb) {
	var self = this
	, table = 'Persistance_'+obj._persisttype
	, query = ''
	, k, keys = Object.keys(conditions);

	if(!keys.length) {
		return self.restore(obj, '%', cb);
	}

	k = keys.pop();
	query = 'select name from '+table+' where field = "'+k+'" and value = "'+conditions[k] +'"';

	keys.forEach(function (x) {
		query = 'select name from '+table+' where name in ('+query+') and '+x+'="'+conditions[x]+'"'
	});
	self.sql3.all(' select name, json from Persistance where name in ('+query+')', function(err, rows) {
		processRows(err, rows, obj, cb);		
	});
}



var store = exports.store = {};

store.open = function (dbname, fn) {
	var self = Object.create(Pers);

	if (!is_function(fn)) {
		fn = function () {};
	}
	self.sql3 = new Sqlite3.Database(dbname, function (err) {
		if (err) {
			return fn(err, undefined);
		}
		self.sql3.exec('create table if not exists Persistance (name text, type text, json text, primary key(name,type))');
		self.sql3.exec('create table if not exists version (id integer)');
		self.sql3.exec('insert or replace into version (id) values (1)');
		return fn(undefined, self);
	});
}
