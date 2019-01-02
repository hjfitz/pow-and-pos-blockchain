const http = require('http')
const socketIO = require('socket.io')
const debug = require('debug')('disparp:server')
const Blockchain = require('./Blockchain')

// initialise network
const server = http.createServer()
const io = socketIO(server, { path: '/', serveClient: false })
server.listen(8080)
server.on('listening', () => {
	debug('server up and running on localhost:8080')
})

// initialise blockchain (stored in memory for now)
const chain = new Blockchain()

chain.createGenesisBlock()


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
	console.log(`zone: ${zoneLabel}; nodes: ${nodeZones[zoneLabel]}; total: ${Object.values(nodeZones[zoneLabel]).length}`)
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

		// make sure ready nodes is unique (cast to set then to array)
		readyNodes = [...new Set(readyNodes)]

		// calculate readiness criteria
		const isReady = (((readyNodes.length / total) > 0.5) && total >= 3)
		debug({ total })
		if (isReady) {
			debug('beginning vote')
			const majorityLocation = readyNodes.reduce((acc, cur) => {
				if (acc[cur.data.vote]) acc[cur.data.vote]++
				else acc[cur.data.vote] = 1
				return acc
			}, {})
			// double check this
			const voted = Object.keys(majorityLocation).reduce((a, b) => (majorityLocation[a] > majorityLocation[b] ? a : b))
			console.log({ voted, majorityLocation })
		}
	})

	// each node generates a transaction and relays it to center,
	// thus relaying it back to everyone else
	// giving all nodes an equal chance to add their own transactions
	socket.on('transaction', (data) => {
		io.sockets.emit('transaction', data)
	})
})
