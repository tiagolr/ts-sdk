import ScriptChunk from './ScriptChunk.js'
import OP from './OP.js'
import { encode, Reader, Writer, toArray } from '../primitives/utils.js'

export default class Script {
  chunks: ScriptChunk[]

  static fromASM (asm: string): Script {
    const chunks: ScriptChunk[] = []
    const tokens = asm.split(' ')
    let i = 0
    while (i < tokens.length) {
      const token = tokens[i]
      let opCode
      let opCodeNum: number
      try {
        opCode = token
        opCodeNum = OP[token]
      } catch (err) {
        opCode = undefined
        opCodeNum = undefined
      }

      // we start with two special cases, 0 and -1, which are handled specially in
      // toASM. see _chunkToString.
      if (token === '0') {
        opCodeNum = 0
        chunks.push({
          op: opCodeNum
        })
        i = i + 1
      } else if (token === '-1') {
        opCodeNum = OP.OP_1NEGATE
        chunks.push({
          op: opCodeNum
        })
        i = i + 1
      } else if (opCode === undefined) {
        const hex = tokens[i]
        const arr = toArray(hex, 'hex')
        if (encode(arr, 'hex') !== hex) {
          throw new Error('invalid hex string in script')
        }
        const len = arr.length
        if (len >= 0 && len < OP.OP_PUSHDATA1) {
          opCodeNum = len
        } else if (len < Math.pow(2, 8)) {
          opCodeNum = OP.OP_PUSHDATA1
        } else if (len < Math.pow(2, 16)) {
          opCodeNum = OP.OP_PUSHDATA2
        } else if (len < Math.pow(2, 32)) {
          opCodeNum = OP.OP_PUSHDATA4
        }
        chunks.push({
          data: arr,
          op: opCodeNum
        })
        i = i + 1
      } else {
        chunks.push({
          op: opCodeNum
        })
        i = i + 1
      }
    }
    return new Script(chunks)
  }

  static fromHex (hex: string): Script {
    return Script.fromBinary(toArray(hex, 'hex'))
  }

  static fromBinary (bin: number[]): Script {
    const chunks: ScriptChunk[] = []

    const br = new Reader(bin)
    while (!br.eof()) {
      const op = br.readUInt8()

      let len = 0
      // eslint-disable-next-line @typescript-eslint/no-shadow
      let data: number[] = []
      if (op > 0 && op < OP.OP_PUSHDATA1) {
        len = op
        chunks.push({
          data: br.read(len),
          op
        })
      } else if (op === OP.OP_PUSHDATA1) {
        try {
          len = br.readUInt8()
          data = br.read(len)
        } catch (err) {
          br.read()
        }
        chunks.push({
          data,
          op
        })
      } else if (op === OP.OP_PUSHDATA2) {
        try {
          len = br.readUInt16LE()
          data = br.read(len)
        } catch (err) {
          br.read()
        }
        chunks.push({
          data,
          op
        })
      } else if (op === OP.OP_PUSHDATA4) {
        try {
          len = br.readUInt32LE()
          data = br.read(len)
        } catch (err) {
          br.read()
        }
        chunks.push({
          data,
          op
        })
      } else {
        chunks.push({
          op
        })
      }
    }
    return new Script(chunks)
  }

  constructor (chunks: ScriptChunk[] = []) {
    this.chunks = chunks
  }

  toASM (): string {
    let str = ''
    for (let i = 0; i < this.chunks.length; i++) {
      const chunk = this.chunks[i]
      str += this._chunkToString(chunk)
    }

    return str.slice(1)
  }

  toHex (): string {
    return encode(this.toBinary(), 'hex') as string
  }

  toBinary (): number[] {
    const writer = new Writer()

    for (let i = 0; i < this.chunks.length; i++) {
      const chunk = this.chunks[i]
      const op = chunk.op
      writer.writeUInt8(op)
      if (chunk.data) {
        if (op < OP.OP_PUSHDATA1) {
          writer.write(chunk.data)
        } else if (op === OP.OP_PUSHDATA1) {
          writer.writeUInt8(chunk.data.length)
          writer.write(chunk.data)
        } else if (op === OP.OP_PUSHDATA2) {
          writer.writeUInt16LE(chunk.data.length)
          writer.write(chunk.data)
        } else if (op === OP.OP_PUSHDATA4) {
          writer.writeUInt32LE(chunk.data.length)
          writer.write(chunk.data)
        }
      }
    }

    return writer.toArray()
  }

  private _chunkToString (chunk: ScriptChunk): string {
    const op = chunk.op
    let str = ''
    if (!chunk.data) {
      // no data chunk
      if (typeof OP[op] !== 'undefined') {
        // A few cases where the opcode name differs from reverseMap
        // aside from 1 to 16 data pushes.
        if (op === 0) {
          // OP_0 -> 0
          str = str + ' 0'
        } else if (op === 79) {
          // OP_1NEGATE -> 1
          str = str + ' -1'
        } else {
          str = str + ' ' + OP[op]
        }
      } else {
        let numstr = op.toString(16)
        if (numstr.length % 2 !== 0) {
          numstr = '0' + numstr
        }
        str = str + ' ' + numstr
      }
    } else {
      // data chunk
      if (chunk.data) {
        str = str + ' ' + encode(chunk.data, 'hex')
      }
    }
    return str
  }
}
