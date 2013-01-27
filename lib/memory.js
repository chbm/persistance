/*
 *
 */

var uuid = require('node-uuid')
	, util = require('util');

"use strict";


function is_object(o) {
	return (o && (typeof o === 'object'));
}

function is_function(o) {
	return (o && (typeof o === 'function'));
}

var store = exports.store = {};


var Mem = {
	persist: function (obj, cb) {
		this.bag[obj._persisttype][obj._persistname] = obj;
		cb(undefined, obj);
	},

	restore: function (type, key, cb) {
		var stuff = {};
		if (key) {
			stuff[key] = this.bag[type._persisttype][key];
			cb(undefined, stuff);
		} else {
			cb(undefined, this.bag[type._persisttype]);
		}
	},

	forget: function (obj) {
		delete this.bag[obj._persisttype][obj._persistname];
	},

	define: function (baseObj) {
		this.bag[baseObj._persisttype] = {};
	}
};

store.open = function (dbname, fn) {
	var self = Object.create(Mem);

	if (!is_function(fn)) {
		fn = function () {};
	}

	self.bag = {};

	fn(undefined, self);
}


