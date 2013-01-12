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
		throw Error('cant persist something ive not been informed about');
	}
	self.sql3.run('insert or replace into Persistance (name, type, json) values (?,?,?)'
								 , [obj._persistname, obj._persisttype, JSON.stringify(obj)]
								, function (err) {
										if(is_function(cb)) {
											return cb(err, obj);
										} else {
											self.emit('saved', err, obj);
										}
									}); 

}

Pers.persistall = function () {
	var self = this;

	for(var n in self.bag) {
		self.persist(self.bag[n]);
	}
}

Pers.restore = function(type, key, cb) {
	var self = this, typename;

	if(!is_object(type) && !is_function(type)) throw Error('need a type to restore');
	if(!type._persisttype) throw Error('not informed about '+type);

	key = key || '%';
	self.sql3.all('select name, json from Persistance where type = ? and name like ?', [type._persisttype, key], function(err, rows) {
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

Pers.forget = function(obj) {
	var self = this;
	if(!is_object(obj)) throw  Error('can only forget objects');

	self.sql3.run('delete from Persistance where type = ? and name = ?', [obj._persisttype, obj._persistname]);
	delete self.bag[obj._persisttype+obj._persistname]; 
	if(obj.hasOwnProperty('_persisttype')) delete obj._persisttype;
	if(obj.hasOwnProperty('_persistname')) delete obj._persistname;
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

