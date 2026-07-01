const sharp = require('sharp')
const path = require('path')

const iconDir = path.join(__dirname, '../public/icons')
const sizes = [72, 96, 128, 144, 152, 192, 384, 512]

// Flood fill white corners with teal so icon fills the full canvas
async function fillWhiteCorners(inputBuffer, tealR = 75, tealG = 191, tealB = 191) {
  const { data: raw, info } = await sharp(inputBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width, height, channels } = info
  const visited = new Uint8Array(width * height)
  const queue = []

  function isWhite(x, y) {
    const idx = (y * width + x) * channels
    return raw[idx] > 230 && raw[idx + 1] > 230 && raw[idx + 2] > 230
  }

  // Seed BFS from all 4 corners
  for (const [sx, sy] of [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]]) {
    if (!visited[sy * width + sx] && isWhite(sx, sy)) {
      queue.push([sx, sy])
      visited[sy * width + sx] = 1
    }
  }

  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]]
  while (queue.length) {
    const [x, y] = queue.shift()
    const idx = (y * width + x) * channels
    raw[idx] = tealR
    raw[idx + 1] = tealG
    raw[idx + 2] = tealB
    raw[idx + 3] = 255

    for (const [dx, dy] of dirs) {
      const nx = x + dx, ny = y + dy
      if (nx >= 0 && nx < width && ny >= 0 && ny < height && !visited[ny * width + nx] && isWhite(nx, ny)) {
        visited[ny * width + nx] = 1
        queue.push([nx, ny])
      }
    }
  }

  // Convert RGBA back to RGB buffer
  const rgbData = Buffer.alloc(width * height * 3)
  for (let i = 0; i < width * height; i++) {
    rgbData[i * 3] = raw[i * 4]
    rgbData[i * 3 + 1] = raw[i * 4 + 1]
    rgbData[i * 3 + 2] = raw[i * 4 + 2]
  }

  return { data: rgbData, width, height }
}

async function main() {
  const source = path.join(iconDir, 'icon-512x512.png')

  // 1. Trim outer white padding
  const { data: trimmed, info: trimInfo } = await sharp(source)
    .trim({ background: '#ffffff', threshold: 30 })
    .toBuffer({ resolveWithObject: true })

  console.log(`트림 결과: ${trimInfo.width}x${trimInfo.height}`)

  // 2. Resize to 512x512 (fill)
  const fullSize = await sharp(trimmed)
    .resize(512, 512, { fit: 'fill', kernel: 'lanczos3' })
    .toBuffer()

  // 3. Flood-fill white corners with teal
  const { data: filled, width, height } = await fillWhiteCorners(fullSize)
  console.log('흰 코너 → teal 채움 완료')

  // 4. Generate all sizes from the filled source
  for (const size of sizes) {
    await sharp(filled, { raw: { width, height, channels: 3 } })
      .resize(size, size, { fit: 'fill', kernel: 'lanczos3' })
      .png()
      .toFile(path.join(iconDir, `icon-${size}x${size}.png`))
    console.log(`✓ icon-${size}x${size}.png`)
  }

  await sharp(filled, { raw: { width, height, channels: 3 } })
    .resize(180, 180, { fit: 'fill', kernel: 'lanczos3' })
    .png()
    .toFile(path.join(iconDir, 'apple-touch-icon.png'))
  console.log('✓ apple-touch-icon.png (180x180)')
}

main().catch(console.error)
