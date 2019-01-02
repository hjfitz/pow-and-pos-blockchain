const sha256 = require('crypto-js/sha256')
const b64 = require('crypto-js/enc-base64')
const debug = require('debug')('disparp:blockchain')

module.exports = class Blockchain {
	constructor(blocks = [], prevHash = '') {
		this.blocks = blocks
		this.prevHash = prevHash
	}

	get prevLocation() {
		return this.blocks.length ? this.blocks[this.blocks.length - 1].location : 0
	}

	createGenesisBlock() {
		debug('creating genesis block')
		const creationTime = ~~(new Date().getTime() / 1000)
		this.add({ creationTime, location: '0' })
		debug('genesis block added')
	}

	generateHash() {
		debug('creating hash for new block')
		const end = JSON.stringify(this.blocks[this.blocks.length - 1])
		const hash = b64.stringify(sha256(end))
		debug(`new hash: ${hash}`)
		return hash
	}

	serialize() {
		return {
			blocks: this.blocks,
			prevHash: this.prevHash,
		}
	}

	add(data) {
		this.prevHash = this.generateHash()
		this.blocks.push({ data, prevHash: this.prevHash })
		this.blocks[this.blocks.length - 1].hash = this.generateHash()
	}
}
