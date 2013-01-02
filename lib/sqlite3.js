/*
 * 
 */
var Sqlite3 = require('sqlite3')
	, uuid = require('node-uuid')
  , util = require('util')
	, events = require('events');

// ---- SQLITE

function is_object(o) {
	return (o && (typeof o === 'object'));
}

function is_function(o) {
	return (o && (typeof o === 'function'));
}

var sqlite3 = exports.sqlite3 = {};

sqlite3.openStore = function (dbname, fn) {
	var store = new Sqlite3.Database(dbname, function(err) {
		if(err) fn(err);
		store.exec('create table if not exists Persistance (name text, type text, json text, primary key(name,type))');
	});
	return store;
}

sqlite3.persist = function(obj, cb) {
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

}

sqlite3.persistall = function () {
	var self = this;

	for(var n in self.bag) {
		self.persist(self.bag[n]);
	}
}

sqlite3.restore = function(type, key, cb) {
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

sqlite3.forget = function(obj) {
	var self = this;
	if(!is_object(obj)) throw  Error('can only forget objects');

	self.store.run('delete from Persistance where type = ? and name = ?', [obj._persisttype, obj._persistname]);
	delete self.bag[obj._persisttype+obj._persistname]; 
	if(obj.hasOwnProperty('_persisttype')) delete obj._persisttype;
	if(obj.hasOwnProperty('_persistname')) delete obj._persistname;
}

