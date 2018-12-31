const sha256 = require('crypto-js/sha256')

const hash = word => sha256(word).toString()

function proofOfWork(data) {
    const timestamp = new Date().getTime()
    let nonce = 0
    let getPayload = () => JSON.stringify({ timestamp, nonce, data })
    let curHash = hash(getPayload())
    while (curHash.indexOf('0000') !== 0) {
        nonce++
        curHash = hash(getPayload())
    }
    return Object.assign({}, JSON.parse(getPayload()), {curHash})
}

console.log(proofOfWork('oioi'))