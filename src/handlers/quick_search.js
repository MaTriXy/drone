#!/usr/bin/env node
'use strict';

const Chalk = require('chalk');
const Hive = require('../handlers/hive');
const log = console.log;
const Log = require('../utils/log_utils');
const Constants = require('../utils/constants');
const fs = require('fs-extra');
const FileHound = require('filehound');
const Similarity = require('string-similarity');
const Suggestions = require('../handlers/suggestions');
const Utils = require('../utils/utils');

function readFile(path) {
	return fs.readFile(path)
		.then(content => JSON.parse(content));
}

function findMatch(term, items) {
	let result = items;
	let newTerm = term;
	if (term.indexOf('/') === -1) {
		result = items.map(item => item.split('/')[1])
	}

	if (result.indexOf(term) !== -1) {
		const index = result.indexOf(term);
		newTerm = items[index]
	}

	return newTerm;
}

// Main code //
const self = module.exports = {
	findAllJsonFiles: () => { 
		return FileHound.create()
			.paths(Constants.HIVE_LIBS_DIR)
			.ext('json')
			.find();
	},

	getLibraryInfo: library => {
    const path = `${Constants.HIVE_LIBS_DIR}/${library}.json`;
    return require(path);
  },

	generateSummary: () => {
		return self.findAllJsonFiles()	
		.then(items => {
			let libraries = [];

			items.forEach(item => {
				var toSave = {}
				var libraryName = item.replace(Constants.HIVE_LIBS_DIR+'/', '').replace('.json','');
				var info = self.getLibraryInfo(libraryName)
				
				toSave = {
					name: libraryName,
					author: info.author.name,
					description: info.description,
					searchable: libraryName + ` | ` + info.description + ` | ` + info.author.name
				}

				libraries.push(toSave);
			});

			return libraries;
		});
	},

	initOrUpdateFile: () => {
		return self.generateSummary()
			.then(items => {
				self.save(items);
				return items;
			})
	},

	save: (items) => {
		fs.writeFileSync(Constants.HIVE_SUMMARY_FILE, JSON.stringify(items, null, 2), 'utf-8'); 
	},

	read: () => {
		let arrayOfPairs;
		if (fs.existsSync(`${Constants.HIVE_SUMMARY_FILE}`)) {
			arrayOfPairs = readFile(Constants.HIVE_SUMMARY_FILE)
		} else {
			arrayOfPairs = self.initOrUpdateFile();
		}

		return arrayOfPairs;
	},

	getPairFromInput: term => { 
		return self.read()
			.then(items => {
				return findMatch(term, items);
			});
	},

	search: term => {
		return self.read()
			.then(items => {
				const rightTerm = findMatch(term, items);
				return Similarity.findBestMatch(rightTerm, items).bestMatch;
			})
	},

	searchWithMatches: term => {
		return self.read()
			.then(items => {
				const rightTerm = findMatch(term, items);				
				return Similarity.findBestMatch(rightTerm, items);
			})
	},

	searchWithSuggestions: term => {
		self.searchWithMatches(term)
			.then(result => {
				if (result.ratings.length > 0) {
					self.showSuggestionsIfPresent(result.ratings, term);
				} else {
					Utils.suggestCreation(term);
				}
			});
	},

	showSuggestionsIfPresent: (ratings, term) => {
		let suggestions = Suggestions.getSuggestions(ratings)

		if (suggestions.length > 0) {
			Log.title(`Look at what I found`);
			suggestions.forEach(item => {
				log(item);
			})
		} else {
			Utils.suggestCreation(term);  
		}
	}
};
