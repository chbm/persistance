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


var Backend = {
	persist: function (obj, cb) {
		
		cb(undefined, obj);
	},

	restore: function (type, key, cb) {
		if (key) {
			
			cb(undefined, stuff);
		} else {
			
			cb(undefined, this.bag[type._persisttype]);
		}
	},

	forget: function (obj) {
	
	},

	define: function (baseObj) {
	
	}

	search: function (obj, conditions) {
		//expose this property only if you want to provide native search
	}
};

store.open = function (dbname, fn) {
	var self = Object.create(Backend);

	if (!is_function(fn)) {
		fn = function () {};
	}


	fn(undefined, self);
}


