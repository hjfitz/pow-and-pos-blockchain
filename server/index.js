const http = require('http')
const socketIO = require('socket.io')
const perfy = require('perfy')
const debug = require('debug')('disparp:server')
const Blockchain = require('./Blockchain')

// initialise network
const server = http.createServer()
const io = socketIO(server, { path: '/', serveClient: false })
server.listen(8080)
server.on('listening', () => {
	debug('server up and running on localhost:8080')
})

let timerRunning = false
const results = []

// initialise blockchain (stored in memory for now)
const chain = new Blockchain()
// nodes separated by location
const nodeZones = {
	0: {},
	1: {},
	2: {},
	3: {},
}

const getTotalNodes = () => Object.values(
	// Object.assign({}, cur, acc) because no fucky with memory items
	Object.values(nodeZones).reduce((acc, cur) => Object.assign({}, cur, acc), {}),
).length

let readyNodes = []

const getAvailableZones = () => Object.keys(nodeZones).filter((zoneLabel) => {
	console.log(
		`zone: ${zoneLabel};`
		+ ` num nodes: ${Object.values(nodeZones[zoneLabel]).length}`,
		+'\n',
	)
	return Object.values(nodeZones[zoneLabel]).length
})

// all network connections happen here
io.on('connect', (socket) => {
	socket.emit('chain', chain.serialize())
	socket.on('join', (data) => {
		// mirrors a node saying to other nodes that it is ready for a transaction
		debug(`node joined network: ${socket.id} with location: ${data.location}`)
		debug('adding node to location...')
		if (nodeZones[data.location]) {
			debug(`adding to zone ${data.location}`)
			nodeZones[data.location][socket.id] = socket
		} else {
			debug(`Creating new zone: ${data.location}`)
			nodeZones[data.location] = { [socket.id]: socket }
		}
		io.sockets.emit('availZones', getAvailableZones())
		socket.emit('beginTransacting')
		debug('nodes added')
	})

	// prune dead nodes
	socket.on('disconnect', () => {
		debug('disconnect, performing cleanup')
		debug(`removing ${socket.id}`)
		readyNodes.splice(readyNodes.indexOf(socket), 1)
		Object.values(nodeZones).forEach((area) => {
			if (area[socket.id]) delete area[socket.id]
		})
	})

	socket.on('ready', (data) => {
		socket.emit('stopTransacting')
		debug('node ready', socket.id)
		debug(`block: ${data}`)
		// handle votes here
		readyNodes.push({ socket, data })
		const total = getTotalNodes()
		debug(`ready nodes: ${readyNodes.length}; total nodes: ${total}`)

		// console.log('===trans')
		// console.log(data.newBlock.transactions)
		// console.log('===')

		// make sure ready nodes is unique (cast to set then to array)
		readyNodes = [...new Set(readyNodes)]
		// console.log('===ready')
		// console.log(readyNodes)
		// console.log('===')

		// calculate readiness criteria
		const percReady = readyNodes.length / total
		const moreThan3 = total > 3


		const isReady = (percReady > 0.5 && moreThan3)
		debug({ total })
		if (isReady) {
			debug('initialising vote')
			const flattened = readyNodes
				.map(node => ({
					vote: node.data.vote,
					location: node.data.location,
					hash: node.data.newBlock.work.curHash,
					block: node.data.newBlock,
					id: node.socket.id,
				}))
			const minified = flattened
				.reduce((acc, cur) => {
					if (!acc[cur.vote]) acc[cur.vote] = [cur.hash]
					else acc[cur.vote].push(cur.hash)
					return acc
				}, {})

			const readyByLocation = flattened.reduce((acc, cur) => {
				if (!acc[cur.location]) acc[cur.location] = [cur]
				else acc[cur.location].push(cur)
				return acc
			}, {})
			// console.log(readyByLocation)
			const voted = Object.keys(minified)
				.reduce((a, b) => (minified[a].length > minified[b].length ? a : b))
			// debug({ minified, voted })
			const hash = minified[voted][0] // fetch the first hash
			const index = parseInt([...hash].splice(0, (hash.length / 8)).join(''), 16)
			let toAdd = Object.values(Object.values(readyByLocation)[0])[0]
			if (readyByLocation[voted]) {
				// console.log(`found one by location. location: ${voted}`)
				const nodes = Object.values(readyByLocation[voted])
				// console.log({ index, length: nodes.length })
				const nodeIndex = index % nodes.length
				// console.log({ nodeIndex })
				const { id } = nodes[nodeIndex];
				[toAdd] = flattened.filter(elem => elem.id === id)
			}
			// if (toAdd && 'block' in toAdd) {
			debug('====adding====')
			chain.add(toAdd.block)
			debug('====done adding====')
			// }
			readyNodes.forEach((node) => {
				// console.log(idx)
				node.socket.emit('chain', chain.serialize())
				node.socket.emit('beginTransacting')
			})
			try {
				const result = perfy.end('block-generation')
				timerRunning = false
				results.push(result)
				const totalTime = results.reduce((acc, cur) => acc + parseFloat(cur.time, 10), 0)
				const average = (totalTime / results.length).toFixed(5)
				console.log(
					`block time: ${result.time}s;`
					+ `total blocks computed: ${results.length};`
					+ `average time: ${average}`,
				)
				if (results.length === 100) {
					console.log(`benchmark with ${getTotalNodes()} nodes complete. Exiting...`)
					process.exit(0)
				}
			} catch (err) {
				//
			}

			readyNodes = []
		}
	})

	// each node generates a transaction and relays it to center,
	// thus relaying it back to everyone else
	// giving all nodes an equal chance to add their own transactions
	socket.on('transaction', (data) => {
		// start on first transaction and end on emission of blockchain.
		// ensure this doesn't get overwritten.
		if (!timerRunning) {
			perfy.start('block-generation')
			timerRunning = true
		}
		io.sockets.emit('transaction', data)
	})
})
