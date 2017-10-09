var esprima = require("esprima");
var options = {tokens:true, tolerant: true, loc: true, range: true };
var faker = require("faker");
var fs = require("fs");
faker.locale = "en";
var mock = require('mock-fs');
var _ = require('underscore');
var Random = require('random-js');
var filePath;

function main()
{
	var args = process.argv.slice(2);

	if( args.length == 0 )
	{
		args = ["subject.js"];
		//args = ["mystery.js"];
	}
	filePath = args[0];

	constraints(filePath);

	generateTestCases()

}

function permute(arg) {
    var r = [], max = arg.length - 1;
    // var r = [], arg=arguments,max = arg.length-1;
    function helper(arr, i) {
        for (var j=0, l=arg[i].length; j<l; j++) {
            var a = arr.slice(0); 
            a.push(arg[i][j]);
            if (i==max)
                r.push(a);
            else
                helper(a, i+1);
        }
    }
    helper([], 0);
    return r;
}

var engine = Random.engines.mt19937().autoSeed();

function createConcreteIntegerValue( greaterThan, constraintValue )
{
	if( greaterThan )
		return Random.integer(constraintValue,constraintValue+10)(engine);
	else
		return Random.integer(constraintValue-10,constraintValue)(engine);
}

function generateRandomString( pool ) {
	return Random.string()(engine, pool.length);
}

function Constraint(properties)
{
	this.ident = properties.ident;
	this.expression = properties.expression;
	this.operator = properties.operator;
	this.value = properties.value;
	this.altvalue = properties.altvalue;
	this.funcName = properties.funcName;
	// Supported kinds: "fileWithContent","fileExists", "fileWithoutContent"
	// integer, string, phoneNumber
	this.kind = properties.kind;
}

function fakeDemo()
{
	console.log( faker.phone.phoneNumber() );
	console.log( faker.phone.phoneNumberFormat() );
	console.log( faker.phone.phoneFormats() );
}

var functionConstraints =
{
}

var mockFileLibrary = 
{
	pathExists:
	{
		'path/fileExists': {}
	},
	pathExistsWithContent:
	{
		'path/fileExistsWithContent': 
		{
    		'some-file.txt': 'file content here',
    	},
	},
	fileWithContent:
	{
		pathContent: 
		{	
  			file1: 'text content',
		}
	},
	fileWithoutContent:
	{
		pathContent2:
		{
			file2: '',
		}
	}
};

function initalizeParams(constraints)
{
	var params = {};
	
	// initialize params
	for (var i =0; i < constraints.params.length; i++ )
	{
		var paramName = constraints.params[i];
		//params[paramName] = '\'\'';
		//allow multiple constraints per parameter, then jumble them
		params[paramName] = [];
	}
	return params;	
}

function fillParams(constraints,params,property)
{
	// plug-in values for parameters
	for( var c = 0; c < constraints.length; c++ )
	{
		var constraint = constraints[c];
		if( params.hasOwnProperty( constraint.ident ) )
		{
			//instead of one constraint per paramName, allow multiple, so push
			//params[constraint.ident] = constraint[property];
			params[constraint.ident].push(constraint[property]);
			//params[constraint.ident].push('\'\'');
		}
	}
}

function generateTestCases()
{

	var content = "var subject = require('./"+filePath+"')\nvar mock = require('mock-fs');\n";
	for ( var funcName in functionConstraints )
	{

		console.log(funcName);
		var params = initalizeParams(functionConstraints[funcName]);

		//var altparams = initalizeParams(functionConstraints[funcName]);
		
		//console.log( params );

		// update parameter values based on known constraints.
		var constraints = functionConstraints[funcName].constraints;

		// Handle global constraints...
		var fileWithContent = _.some(constraints, {kind: 'fileWithContent' });
		var pathExists      = _.some(constraints, {kind: 'fileExists' });
		var pathExistsWithContent = _.some(constraints, {kind: 'fileExistsWithContent' });
		var fileWithoutContent = _.some(constraints, {kind: 'fileWithoutContent' });

		fillParams(constraints,params,"value");
		//fillParams(constraints,altparams,"altvalue")
		

		//Get all the keys in params which is each parameter for this function
		var keys = [];
		for (var key in params) {
			// each of these is a variable we will be manipulating
    		keys.push(key);
		}

		var constraintsbykey = [];
		for(var i = 0; i < keys.length; i++)
		{
			var k = keys[i];
			var constr = params[k];
			//This lists each varialble, and each value we need to set it too
			//console.log("VAR: " + k + " -> " + constr);
			constraintsbykey.push(constr);
		}

		// This permuted array has all the different combinations of parameters we want to try for this function
		permutedArray = permute(constraintsbykey);
		//console.log(permutedArray);

		// This will pass in the empty strings to the methods that take them
		if (permutedArray.length == 0) 
		{
			var argsNotJoined = [];
			//pass empty string to each key/parameter for the function
			for(var i = 0; i < keys.length; i++) {
				argsNotJoined.push('\'\'');
			}

			var args = argsNotJoined.join(",");
			//console.log(args)
			if( pathExists || fileWithContent || pathExistsWithContent || fileWithoutContent)
			{
				content += generateMockFsTestCases(pathExists,fileWithContent,funcName, args);
				// Bonus...generate constraint variations test cases....
				content += generateMockFsTestCases(!pathExists,fileWithContent,funcName, args);
				content += generateMockFsTestCases(pathExists,!fileWithContent,funcName, args);
				content += generateMockFsTestCases(!pathExists,!fileWithContent,funcName, args);
			}
			else
			{
				// Emit simple test case.
				content += "subject.{0}({1});\n".format(funcName, args );
			}
		}

		for(var i = 0; i < permutedArray.length; i++)
		{
			console.log(permutedArray[i]);
			var args = permutedArray[i].join(",");


			//var args = Object.keys(params).map( function(k) {return permutedArray[i]; }).join(",");
			//console.log(args)
			if( pathExists || fileWithContent || pathExistsWithContent || fileWithoutContent)
			{
				content += generateMockFsTestCases(pathExists,fileWithContent,funcName, args);
				// Bonus...generate constraint variations test cases....
				content += generateMockFsTestCases(!pathExists,fileWithContent,funcName, args);
				content += generateMockFsTestCases(pathExists,!fileWithContent,funcName, args);
				content += generateMockFsTestCases(!pathExists,!fileWithContent,funcName, args);
			}
			else
			{
				// Emit simple test case.
				content += "subject.{0}({1});\n".format(funcName, args );
			}

		}
	}
	// Write out the method calls to test.js
	fs.writeFileSync('test.js', content, "utf8");

}

function generateMockFsTestCases (pathExists,fileWithContent,funcName,args) 
{
	var testCase = "";
	// Build mock file system based on constraints.
	var mergedFS = {};
	if( pathExists )
	{
		for (var attrname in mockFileLibrary.pathExists) { mergedFS[attrname] = mockFileLibrary.pathExists[attrname]; }
		for (var attrname in mockFileLibrary.pathExistsWithContent) { mergedFS[attrname] = mockFileLibrary.pathExistsWithContent[attrname]; }
	}
	if( fileWithContent )
	{
		for (var attrname in mockFileLibrary.fileWithContent) { mergedFS[attrname] = mockFileLibrary.fileWithContent[attrname]; }
		for (var attrname in mockFileLibrary.fileWithoutContent) { mergedFS[attrname] = mockFileLibrary.fileWithoutContent[attrname]; }
	}

	testCase += 
	"mock(" +
		JSON.stringify(mergedFS)
		+
	");\n";

	testCase += "\tsubject.{0}({1});\n".format(funcName, args );
	testCase+="mock.restore();\n";
	return testCase;
}

function constraints(filePath)
{
   var buf = fs.readFileSync(filePath, "utf8");
	var result = esprima.parse(buf, options);

	traverse(result, function (node) 
	{
		if (node.type === 'FunctionDeclaration') 
		{
			var funcName = functionName(node);
			console.log("Line : {0} Function: {1}".format(node.loc.start.line, funcName ));

			var params = node.params.map(function(p) {return p.name});

			functionConstraints[funcName] = {constraints:[], params: params};

			// Check for expressions using argument.
			traverse(node, function(child)
			{
				if( child.type === 'BinaryExpression')
				{
					// set phone number!!
					if( child.left.type == 'Identifier' && child.left.name == 'area')
					{
						console.log( functionConstraints[funcName].params );
						for( var i = 0; i < functionConstraints[funcName].params.length; i++ )
						{
							if ( functionConstraints[funcName].params[i] == 'phoneNumber' )
							{
								var rightHand = buf.substring(child.right.range[0], child.right.range[1])
								var restOfPhone = faker.phone.phoneNumberFormat();
								rightHand = rightHand.substring(1,4) + restOfPhone.substring(3,restOfPhone.length-1);
								console.log(rightHand);


								// set a constraint with a phone number with the same area code as area var
								functionConstraints[funcName].constraints.push( 
								new Constraint(
								{
									ident: functionConstraints[funcName].params[i],
									value: "\""+rightHand+"\"",
									//altvalue: !rightHand,
									funcName: funcName,
									kind: "integer",
									operator : child.operator,
									expression: expression
								}));

								// set a constraint with a phone number with no area code aka not the area code we need for
								functionConstraints[funcName].constraints.push( 
								new Constraint(
								{
									ident: functionConstraints[funcName].params[i],
									//value: "\""+faker.phone.phoneNumberFormat()+"\"",
									value: "\""+"\"",
									//altvalue: !rightHand,
									funcName: funcName,
									kind: "integer",
									operator : child.operator,
									expression: expression
								}));

								
							}
						}
					}
					
					
					if( child.left.type == 'Identifier' && params.indexOf( child.left.name ) > -1)
					{
						// get expression from original source code:
						var expression = buf.substring(child.range[0], child.range[1]);
						var rightHand = buf.substring(child.right.range[0], child.right.range[1])

						// functionConstraints[funcName].constraints.push( 
						// 	new Constraint(
						// 	{
						// 		ident: child.left.name,
						// 		value: rightHand,
						// 		//altvalue: !rightHand,
						// 		funcName: funcName,
						// 		kind: "integer",
						// 		operator : child.operator,
						// 		expression: expression
						// 	}));


						if ( typeof(rightHand) == 'integer')
						{
							functionConstraints[funcName].constraints.push( 
							new Constraint(
							{
								ident: child.left.name,
								value: rightHand,
								funcName: funcName,
								kind: "integer",
								operator : child.operator,
								expression: expression
							}));

							functionConstraints[funcName].constraints.push( 
							new Constraint(
							{
								ident: child.left.name,
								value: rightHand + 1,
								funcName: funcName,
								kind: "integer",
								operator : child.operator,
								expression: expression
							}));

						} else if ( typeof(rightHand) == 'string' )
						{
							var craze = "\"" + generateRandomString(rightHand) + "\""
							functionConstraints[funcName].constraints.push( 
							new Constraint(
							{
								ident: child.left.name,
								value: craze,
								funcName: funcName,
								kind: "string",
								operator : child.operator,
								expression: expression
							}));
						}
					}
				}

				if( child.type === 'BinaryExpression' && child.operator == "==" )
				{
					if( child.left.type == 'Identifier' && params.indexOf( child.left.name ) > -1)
					{
						// get expression from original source code:
						var expression = buf.substring(child.range[0], child.range[1]);
						var rightHand = buf.substring(child.right.range[0], child.right.range[1])


						functionConstraints[funcName].constraints.push( 
							new Constraint(
							{
								ident: child.left.name,
								value: rightHand,
								//altvalue: parseInt(rightHand) +1,
								funcName: funcName,
								kind: "integer",
								operator : child.operator,
								expression: expression
							}));
					}
				}

				// if( child.type === 'BinaryExpression' && child.operator == "!=" )
				// {
				// 	if( child.left.type == 'Identifier' && params.indexOf( child.left.name ) > -1)
				// 	{
				// 		// get expression from original source code:
				// 		var expression = buf.substring(child.range[0], child.range[1]);
				// 		var rightHand = buf.substring(child.right.range[0], child.right.range[1])

				// 		functionConstraints[funcName].constraints.push( 
				// 			new Constraint(
				// 			{
				// 				ident: child.left.name,
				// 				value: !rightHand,
				// 				//altvalue: parseInt(rightHand) +1,
				// 				funcName: funcName,
				// 				kind: "integer",
				// 				operator : child.operator,
				// 				expression: expression
				// 			}));
				// 	}
				// }

				if( child.type === 'BinaryExpression' && child.operator == "<" )
				{
					if( child.left.type == 'Identifier' && params.indexOf( child.left.name ) > -1)
					{
						// get expression from original source code:
						var expression = buf.substring(child.range[0], child.range[1]);
						var rightHand = buf.substring(child.right.range[0], child.right.range[1])

						functionConstraints[funcName].constraints.push( 
							new Constraint(
							{
								ident: child.left.name,
								value: parseInt(rightHand) - 1,
								//altvalue: parseInt(rightHand) +1,
								funcName: funcName,
								kind: "integer",
								operator : child.operator,
								expression: expression
							}));

						functionConstraints[funcName].constraints.push( 
							new Constraint(
							{
								ident: child.left.name,
								value: parseInt(rightHand) + 1,
								//altvalue: parseInt(rightHand) +1,
								funcName: funcName,
								kind: "integer",
								operator : child.operator,
								expression: expression
							}));
					}
				}

				if( child.type === 'BinaryExpression' && child.operator == ">" )
				{
					if( child.left.type == 'Identifier' && params.indexOf( child.left.name ) > -1)
					{
						// get expression from original source code:
						var expression = buf.substring(child.range[0], child.range[1]);
						var rightHand = buf.substring(child.right.range[0], child.right.range[1])

						functionConstraints[funcName].constraints.push( 
							new Constraint(
							{
								ident: child.left.name,
								value: parseInt(rightHand) + 1,
								//altvalue: parseInt(rightHand) +1,
								funcName: funcName,
								kind: "integer",
								operator : child.operator,
								expression: expression
							}));

						functionConstraints[funcName].constraints.push( 
							new Constraint(
							{
								ident: child.left.name,
								value: parseInt(rightHand) - 1,
								//altvalue: parseInt(rightHand) +1,
								funcName: funcName,
								kind: "integer",
								operator : child.operator,
								expression: expression
							}));
					}
				}

				// if( child.type == "CallExpression" && 
				// 	 child.callee.property &&
				// 	 child.callee.property.name =="indexOf" )
				// {
				// 	// for( var p =0; p < params.length; p++ )
				// 	// {
				// 	// 	if( child.arguments[0].name == params[p] )
				// 	// 	{
				// 	// 		functionConstraints[funcName].constraints.push( 
				// 	// 		new Constraint(
				// 	// 		{
				// 	// 			ident: params[p],
				// 	// 			value:  "'pathContent/file1'",
				// 	// 			funcName: funcName,
				// 	// 			kind: "fileWithContent",
				// 	// 			operator : child.operator,
				// 	// 			expression: expression
				// 	// 		}));
				// 	// 	}
				// 	// }

				// 	var expression = buf.substring(child.range[0], child.range[1]);



				// }

				if( child.type == "CallExpression" && 
					 child.callee.property &&
					 child.callee.property.name =="readFileSync" )
				{
					for( var p =0; p < params.length; p++ )
					{
						if( child.arguments[0].name == params[p] )
						{
							// readFileSync only takes a filepath, so only set constraints for that param or will get bad file discreptor error
							if (params[p] == 'filePath'){
								functionConstraints[funcName].constraints.push( 
								new Constraint(
								{
									ident: params[p],
									value:  "'pathContent/file1'",
									funcName: funcName,
									kind: "fileWithContent",
									operator : child.operator,
									expression: expression
								}));

								functionConstraints[funcName].constraints.push( 
								new Constraint(
								{
									ident: params[p],
									value:  "'pathContent2/file2'",
									funcName: funcName,
									kind: "fileWithoutContent",
									operator : child.operator,
									expression: expression
								}));
							}
						}
					}
				}

				if( child.type == "CallExpression" &&
					 child.callee.property &&
					 child.callee.property.name =="readdirSync")
				{
					for( var p =0; p < params.length; p++ )
					{
						if( child.arguments[0].name == params[p] )
						{
							// readdirSync only takes dir so only set constraints for that param or will get bad file discreptor error
							if (params[p] == "dir"){
								functionConstraints[funcName].constraints.push( 
								new Constraint(
								{
									ident: params[p],
									// A fake path to an empty dir
									value:  "'path/fileExists'",
									funcName: funcName,
									kind: "fileExists",
									operator : child.operator,
									expression: expression
								}));

								functionConstraints[funcName].constraints.push( 
								new Constraint(
								{
									ident: params[p],
									// A fake path to a dir but with content
									value:  "'path/fileExistsWithContent'",
									funcName: funcName,
									kind: "fileExistsWithContent",
									operator : child.operator,
									expression: expression
								}));
							}
						}
					}
				}
			});

			console.log( functionConstraints[funcName]);

		}
	});
}

function traverse(object, visitor) 
{
    var key, child;

    visitor.call(null, object);
    for (key in object) {
        if (object.hasOwnProperty(key)) {
            child = object[key];
            if (typeof child === 'object' && child !== null) {
                traverse(child, visitor);
            }
        }
    }
}

function traverseWithCancel(object, visitor)
{
    var key, child;

    if( visitor.call(null, object) )
    {
	    for (key in object) {
	        if (object.hasOwnProperty(key)) {
	            child = object[key];
	            if (typeof child === 'object' && child !== null) {
	                traverseWithCancel(child, visitor);
	            }
	        }
	    }
 	 }
}

function functionName( node )
{
	if( node.id )
	{
		return node.id.name;
	}
	return "";
}


if (!String.prototype.format) {
  String.prototype.format = function() {
    var args = arguments;
    return this.replace(/{(\d+)}/g, function(match, number) { 
      return typeof args[number] != 'undefined'
        ? args[number]
        : match
      ;
    });
  };
}

main();
exports.main = main;
