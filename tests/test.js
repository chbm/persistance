
var Persistance = require('../').Persistance;
var repl = require('repl');

var persistance = new Persistance({dbtype: 'sqlite3', dbname: 'teststore'});

var Foo = persistance.define('foo', {
	i: 1,
	s: 'helo',
	a: [],
	o: {}
});

 
var r = repl.start({prompt: 't> '});
r.context.Foo = Foo;
r.context.persistance = persistance;
r.context.Persistance = Persistance;
