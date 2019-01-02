console.log('attempting to join server')
const io = require('socket.io-client')
const debug = require('debug')('disparp:node')
const Blockchain = require('./Blockchain')
const Block = require('./Block')

let chain
let ready = false

const socket = io('http://localhost:8080', { path: '/' })

const location = process.env.LOCATION || 1

debug(`attempting to join with location: ${location}`)

socket.emit('join', { location })

socket.on('chain', (data) => {
	chain = new Blockchain(data.chain, data.prevHash)
	debug('chain recieved')
})

function generateVote(bChain) {
	const locations = [1, 2, 3, 4, 5]
	const { prevLocation } = bChain
	if (locations.includes(location)) locations.splice(locations.indexOf(location), 1)
	if (locations.includes(prevLocation)) locations.splice(locations.indexOf(prevLocation), 1)
	// because genesis is created in location 0
	debug({ locations })
	const vote = locations[~~(Math.random() * locations.length)]
	debug('vote:', vote)
	return vote
}


let block = new Block()
let interval
socket.on('transaction', (data) => {
	if (block.transactions.length >= 4) {
		console.time('Proof of Work')
		if (!ready) { // ignore any further transactions
			const newBlock = block.serialize()
			const vote = generateVote(chain)
			// submit a new block to be randomly selected, as well as the vote
			socket.emit('ready', { newBlock, vote })
			console.timeEnd('Proof of Work')
			debug('PoW:', newBlock)
			block = new Block()
			ready = true
		}
	} else {
		block.add(data)
	}
})


socket.on('beginTransacting', () => {
	ready = false
	debug('beginning transactions')
	interval = setInterval(() => {
		debug('emitting transaction')
		if (!ready) socket.emit('transaction', `test data: ${new Date().getTime()}`)
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