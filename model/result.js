// This file is part of Pa11y Webservice.
//
// Pa11y Webservice is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Pa11y Webservice is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Pa11y Webservice.  If not, see <http://www.gnu.org/licenses/>.

/* eslint id-length: 'off' */
/* eslint no-catch-shadow: 'off' */
/* eslint no-underscore-dangle: 'off' */
/* eslint new-cap: 'off' */
//'use strict';

const {ObjectId} = require('mongodb');

// Result model
module.exports = function(app, callback) {

	let collection = app.db.collection('results');
	collection.createIndex({
		date: 1
	});

	//console.log(app.db.listCollections('results'));

	// app.db.listCollections('results').forEach(function(collection) {
	// 	indexes = db[collection].getIndexes();
	// 	print("Indexes for " + collection + ":");
	// 	printjson(indexes);
	// });

	//app.db.listCollections('results')
	//app.db.collection('results', async (errors, collection) => {
	// 	await collection.createIndex({
	// 		date: 1
	// 	});

		const model = {
			collection: collection,
			// Create a result
			create(newResult) {
				if (!newResult.date) {
					newResult.date = Date.now();
				}
				if (newResult.task && !(newResult.task instanceof ObjectId)) {
					newResult.task = new ObjectId(newResult.task);
				}
				return collection.insertOne(newResult)
					.then(result => {
						return collection.findOne(result.insertedId);
						//return model.prepareForOutput(result.ops[0]);
					})
					.catch(error => {
						console.error('model:result:create failed', error.message);
					});
			},

			// Default filter options
			_defaultFilterOpts(opts) {
				const now = Date.now();
				const thirtyDaysAgo = now - (1000 * 60 * 60 * 24 * 30);
				return {
					from: (new Date(opts.from || thirtyDaysAgo)).getTime(),
					to: (new Date(opts.to || now)).getTime(),
					full: Boolean(opts.full),
					task: opts.task
				};
			},

			// Get results
			_getFiltered(opts) {
				opts = model._defaultFilterOpts(opts);
				const filter = {
					date: {
						$lt: opts.to,
						$gt: opts.from
					}
				};
				if (opts.task) {
					filter.task = new ObjectId(opts.task);
				}

				const prepare = opts.full ? model.prepareForFullOutput : model.prepareForOutput;

				return collection
					.find(filter)
					.sort({date: -1})
					.limit(opts.limit || 0)
					.toArray()
					.then(results => results.map(prepare))
					.catch(error => {
						console.error('model:result:_getFiltered failed');
						console.error(error.message);
					});
			},

			// Get results for all tasks
			getAll(opts) {
				delete opts.task;
				return model._getFiltered(opts);
			},

			// Get a result by ID
			getById(id, full) {
				const prepare = (full ? model.prepareForFullOutput : model.prepareForOutput);
				try {
					id = new ObjectId(id);
				} catch (error) {
					console.error('ObjectId generation failed.', error.message);
					return null;
				}
				return collection.findOne({_id: id})
					.then(result => {
						if (result) {
							result = prepare(result);
						}
						return result;
					})
					.catch(error => {
						console.error(`model:result:getById failed, with id: ${id}`, error.message);
						return null;
					});
			},

			// Get results for a single task
			getByTaskId(id, opts) {
				opts.task = id;
				return model._getFiltered(opts);
			},

			// Delete results for a single task
			deleteByTaskId(id) {
				try {
					id = new ObjectId(id);
				} catch (error) {
					console.error('ObjectId generation failed.', error.message);
					return null;
				}

				return collection.deleteMany({task: ObjectId(id)})
					.catch(error => {
						console.error(`model:result:deleteByTaskId failed, with id: ${id}`);
						console.error(error.message);
					});
			},

			// Get a result by ID and task ID
			getByIdAndTaskId(id, task, opts) {
				const prepare = (opts.full ? model.prepareForFullOutput : model.prepareForOutput);

				try {
					id = new ObjectId(id);
					task = new ObjectId(task);
				} catch (error) {
					console.error('ObjectId generation failed.', error.message);
					return null;
				}

				return collection.findOne({
					_id: ObjectId(id),
					task: ObjectId(task)
				})
					.then(result => {
						if (result) {
							result = prepare(result);
						}
						return result;
					})
					.catch(error => {
						console.error(`model:result:getByIdAndTaskId failed, with id: ${id}`);
						console.error(error.message);
					});
			},

			// Prepare a result for output
			prepareForOutput(result) {
				result = model.prepareForFullOutput(result);
				delete result.results;
				return result;
			},
			prepareForFullOutput(result) {
				return {
					id: result._id.toString(),
					task: result.task.toString(),
					date: new Date(result.date).toISOString(),
					count: result.count,
					ignore: result.ignore || [],
					results: result.results || []
				};
			},
			convertPa11y2Results(results) {
				return {
					count: {
						total: results.issues.length,
						error: results.issues.filter(result => result.type === 'error').length,
						warning: results.issues.filter(result => result.type === 'warning').length,
						notice: results.issues.filter(result => result.type === 'notice').length
					},
					results: results.issues
				};
			}

		};
		callback(null, model);
//	});
};
