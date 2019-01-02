const sha256 = require('crypto-js/sha256')
const b64 = require('crypto-js/enc-base64')
const debug = require('debug')('disparp:blockchain')

module.exports = class Blockchain {
	constructor(chain = [], prevHash = '') {
		this.chain = chain
		this.prevHash = prevHash
	}

	get prevLocation() {
		return this.chain[this.chain.length - 1].location
	}

	createGenesisBlock() {
		debug('creating genesis block')
		const creationTime = ~~(new Date().getTime() / 1000)
		this.add({ creationTime, location: '0' })
		debug('genesis block added')
	}

	generateHash() {
		debug('creating hash for new block')
		const end = this.chain[this.chain.length - 1]
		const hash = b64.stringify(sha256(end))
		debug(`new hash: ${hash}`)
		return hash
	}

	serialize() {
		return {
			chain: this.chain,
			prevHash: this.prevHash,
		}
	}

	add(data) {
		this.chain.push(data)
		this.prevHash = this.generateHash()
	}
}
