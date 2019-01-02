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
const nodeZones = {}

const getTotalNodes = () => Object.values(
	Object.values(nodeZones).reduce((acc, cur) => Object.assign(cur, acc), {}),
).length

let readyNodes = []

// all network connections happen here
io.on('connect', (socket) => {
	socket.emit('chain', chain.serialize())
	socket.on('join', (data) => {
		socket.emit('beginTransacting')
		debug(`node joined network: ${socket.id} with location: ${data.location}`)
		debug('adding node to location...')
		// if (Array.isArray)
		if (nodeZones[data.location]) {
			nodeZones[data.location][socket.id] = socket
		} else {
			nodeZones[data.location] = { [socket.id]: socket }
		}
		debug('nodes added')
	})

	// prune dead nodes
	socket.on('disconnect', () => {
		debug('disconnect, performing cleanup')
		debug(`removing ${socket.id}`)
		readyNodes.splice(readyNodes.indexOf(socket), 1)
		console.log(readyNodes.map(elem => elem.id))
		Object.values(nodeZones).forEach((area) => {
			if (area[socket.id]) delete area[socket.id]
		})
	})

	socket.on('ready', (data) => {
		debug('node ready', socket.id)
		console.log(data)
		// handle votes here
		readyNodes.push(socket)
		debug(`ready nodes: ${readyNodes.length}; total nodes: ${getTotalNodes()}`)

		readyNodes = [...new Set(readyNodes)]
		// tell node to stop transacting
		socket.emit('stopTransacting')
	})

	// each node generates a transaction and relays it to center,
	// thus relaying it back to everyone else
	// giving all nodes an equal chance to add their own transactions
	socket.on('transaction', (data) => {
		io.sockets.emit('transaction', data)
	})
})
