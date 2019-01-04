/**
 * maximum failure, this does not work all of the time
 */

const io = require('socket.io-client')
const sha256 = require('crypto-js/sha256')
const b64 = require('crypto-js/enc-base64')
const debug = require('debug')('disparp:node-malicious')
const cloneDeep = require('lodash/cloneDeep')
const Blockchain = require('./Blockchain')
const Block = require('./Block')

debug('attempting to join server')

let chain
let interval

const socket = io('http://localhost:8080', { path: '/' })

const location = process.env.LOCATION || 1
let locations = [location]

debug(`attempting to join with location: ${location}`)

socket.emit('join', { location })

const sha = data => b64.stringify(sha256(data))

let errors = 0
let safe = 0

function validateChain() {
	debug('validating blockchain')
	const mostRecentBlock = chain.blocks[0]
	debug('ensuring integrity of blockchain...')
	if (!mostRecentBlock) return
	console.log('====')
	console.log(mostRecentBlock.data.transactions)
	if (mostRecentBlock.data.transactions.includes('erroneous blocks')) {
		console.log('found error block')
		errors += 1
	} else {
		console.log('error block not found')
		safe += 1
	}
	console.log(`Safe blocks found: ${safe}; Erroneous blocks found: ${errors}`)
	console.log('====')
	// make sure all transactions are equal
	chain.blocks.forEach((block) => {
		const cloned = cloneDeep(block)
		const theirHash = cloned.hash
		delete cloned.hash
		const ourHash = sha(JSON.stringify(cloned))
		if (ourHash !== theirHash) {
			// remove naughty block
			console.log('removing erroneous block')
			chain.blocks = chain.blocks.splice(chain.blocks.indexOf(block), 1)
		}
	})

	// if they are, cool

	// if not: reject
	debug('validation over')
}

socket.on('chain', (data) => {
	chain = new Blockchain(data.blocks, data.prevHash)
	validateChain(chain)
	// block = new Block()
	debug('chain recieved')
})

function generateVote(bChain) {
	const { prevLocation } = bChain
	const clonedLocs = [...locations]
	if (clonedLocs.includes(location)) clonedLocs.splice(clonedLocs.indexOf(location), 1)
	if (clonedLocs.includes(prevLocation)) clonedLocs.splice(clonedLocs.indexOf(prevLocation), 1)
	// because genesis is created in location 0
	debug({ clonedLocs })
	const vote = clonedLocs[~~(Math.random() * clonedLocs.length)] || location
	debug('vote:', vote)
	return vote
}


// socket.on('transaction', (data) => {
// 	// if (block.transactions.length >= 4) {
// 	// 	console.time('Proof of Work')
// 	// 	if (!ready) { // ignore any further transactions
// 	// 		newBlock = block.serialize()
// 	// 		const vote = generateVote(chain)
// 	// 		// submit a new block to be randomly selected, as well as the vote
// 	// 		socket.emit('ready', { newBlock, vote, location })
// 	// 		console.timeEnd('Proof of Work')
// 	// 		debug('PoW:', newBlock)
// 	// 		ready = true
// 	// 	}
// 	// } else {
// 	// 	block.add(data)
// 	// }
// })

socket.on('availZones', (data) => {
	debug('zones get:', data)
	locations = data
})

const eBlock = new Block()

eBlock.add('erroneous blocks')
eBlock.add('erroneous blocks')
eBlock.add('erroneous blocks')
eBlock.add('erroneous blocks')
eBlock.add('erroneous blocks')

const evilBlock = eBlock.serialize()
debug('malicious PoW complete')

socket.on('beginTransacting', () => {
	// ready = false
	debug('beginning transactions')
	clearInterval(interval)
	// interval = setInterval(() => {
	// 	debug('emitting transaction')
	// 	if (!ready) socket.emit('transaction', 'erroneous blocks')
	// }, 500)
	interval = setInterval(() => {
		debug('emitting transaction')
		// socket.emit('transaction', 'erroneous blocks')
		// newBlock = block.serialize()
		const vote = generateVote(chain)
		// submit a new block to be randomly selected, as well as the vote
		socket.emit('ready', { newBlock: evilBlock, vote, location })
	}, 500)
})

socket.on('stopTransacting', () => {
	debug('stopping transactions')
	clearInterval(interval)
})
socket.on('disconnect', () => {
	debug('server down. exiting with code 1')
	process.exit(1)
})
