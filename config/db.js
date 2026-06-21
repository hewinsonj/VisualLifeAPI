'use strict'

const database = {
	development: 'mongodb://localhost/visual-life-development',
	test: 'mongodb://localhost/visual-life-test',
}

const localDb = process.env.TESTENV ? database.test : database.development

module.exports = process.env.MONGODB_URI || localDb
