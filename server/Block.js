const sha256 = require('crypto-js/sha256')

module.exports = class Block {
	constructor() {
		this.transactions = []
	}

	add(transaction) {
		this.transactions.push(transaction)
	}

	serialize() {
		return {
			transactions: this.transactions,
			work: this.proofOfWork(),
		}
	}

	proofOfWork() {
		const hash = word => sha256(word).toString()
		let nonce = 0
		const data = this.transactions
		const getPayload = () => JSON.stringify({ nonce, data })
		let curHash = hash(getPayload())
		while (curHash.indexOf('0000') !== 0) {
			nonce++
			curHash = hash(getPayload())
		}
		return Object.assign(JSON.parse(getPayload()), { curHash })
	}
}
