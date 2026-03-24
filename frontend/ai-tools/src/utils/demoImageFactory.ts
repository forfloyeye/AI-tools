type DemoSceneSelection = {
  templateId: string;
  framing: string;
  facing: string;
};

type ProductPayload = {
  angleLabel: string;
  imageBase64: string;
  mimeType: string;
};

const DEMO_GRADIENTS = [
  ['#E0F2FE', '#DBEAFE', '#F5F3FF'],
  ['#FEF3C7', '#FDE68A', '#FFEDD5'],
  ['#DCFCE7', '#BFDBFE', '#E0E7FF'],
  ['#FCE7F3', '#FDE68A', '#FECACA'],
  ['#E2E8F0', '#E0F2FE', '#F8FAFC'],
];

function hashSeed(input: string): number {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function pickPalette(seed: string) {
  return DEMO_GRADIENTS[hashSeed(seed) % DEMO_GRADIENTS.length];
}

function toDataUrl(base64: string, mimeType: string): string {
  return `data:${mimeType};base64,${base64}`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('图片加载失败'));
    image.src = src;
  });
}

async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(file);
  try {
    return await loadImage(objectUrl);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function createCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('画布初始化失败');
  }
  return { canvas, context };
}

function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function drawBackdrop(context: CanvasRenderingContext2D, width: number, height: number, seed: string) {
  const [start, middle, end] = pickPalette(seed);
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, start);
  gradient.addColorStop(0.5, middle);
  gradient.addColorStop(1, end);
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  context.globalAlpha = 0.35;
  context.fillStyle = '#ffffff';
  context.beginPath();
  context.arc(width * 0.18, height * 0.22, width * 0.16, 0, Math.PI * 2);
  context.fill();
  context.beginPath();
  context.arc(width * 0.84, height * 0.18, width * 0.12, 0, Math.PI * 2);
  context.fill();
  context.beginPath();
  context.arc(width * 0.72, height * 0.82, width * 0.18, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 1;
}

function drawBadge(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  bgColor: string,
  textColor: string = '#FFFFFF'
) {
  context.save();
  context.font = '600 24px sans-serif';
  const paddingX = 18;
  const paddingY = 10;
  const textWidth = context.measureText(text).width;
  const width = textWidth + paddingX * 2;
  const height = 44;
  context.fillStyle = bgColor;
  drawRoundedRect(context, x, y, width, height, 16);
  context.fill();
  context.fillStyle = textColor;
  context.textBaseline = 'middle';
  context.fillText(text, x + paddingX, y + height / 2 + 1);
  context.restore();
}

function drawTitle(context: CanvasRenderingContext2D, title: string, subtitle: string, width: number) {
  context.save();
  context.fillStyle = '#0F172A';
  context.font = '700 44px sans-serif';
  context.fillText(title, 68, 86);
  context.fillStyle = '#475569';
  context.font = '500 24px sans-serif';
  context.fillText(subtitle, 68, 124, width - 136);
  context.restore();
}

function drawHeroImage(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource,
  options: { x: number; y: number; width: number; height: number }
) {
  const { x, y, width, height } = options;
  context.save();
  context.shadowColor = 'rgba(15, 23, 42, 0.18)';
  context.shadowBlur = 40;
  context.shadowOffsetY = 18;
  context.fillStyle = 'rgba(255,255,255,0.78)';
  drawRoundedRect(context, x, y, width, height, 36);
  context.fill();
  context.clip();
  context.drawImage(image, x + 20, y + 20, width - 40, height - 40);
  context.restore();
}

function canvasToDataUrl(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png');
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('图片生成失败'));
        return;
      }
      resolve(blob);
    }, 'image/png');
  });
}

export async function createDemoSceneImagesFromFiles(
  files: File[],
  sceneLabel: string,
  count: number,
): Promise<string[]> {
  const results: string[] = [];

  for (let sourceIndex = 0; sourceIndex < files.length; sourceIndex += 1) {
    const image = await loadImageFromFile(files[sourceIndex]);

    for (let variantIndex = 0; variantIndex < count; variantIndex += 1) {
      const seed = `${sceneLabel}-${sourceIndex}-${variantIndex}`;
      const { canvas, context } = createCanvas(1080, 1080);
      drawBackdrop(context, canvas.width, canvas.height, seed);
      drawTitle(context, sceneLabel || 'AI 图片风格', '演示模式测试图', canvas.width);
      drawBadge(context, `商品图 ${sourceIndex + 1}`, 68, 954, '#7C3AED');
      drawBadge(context, `方案 ${variantIndex + 1}`, 228, 954, '#0F172A', '#FFFFFF');
      drawHeroImage(context, image, { x: 96, y: 184, width: 888, height: 700 });
      results.push(canvasToDataUrl(canvas));
    }
  }

  return results;
}

export async function createDemoBaseModelImages(products: ProductPayload[], count: number): Promise<string[]> {
  const first = products[0];
  const image = await loadImage(toDataUrl(first.imageBase64, first.mimeType));
  const outputs: string[] = [];

  for (let index = 0; index < count; index += 1) {
    const { canvas, context } = createCanvas(864, 1152);
    drawBackdrop(context, canvas.width, canvas.height, `${first.angleLabel}-${index}`);
    drawTitle(context, 'AI 基准模特', `演示候选 ${index + 1}`, canvas.width);
    drawHeroImage(context, image, { x: 96, y: 190, width: 672, height: 820 });
    drawBadge(context, 'DEMO', 96, 1044, '#2563EB');
    outputs.push(canvasToDataUrl(canvas));
  }

  return outputs;
}

export async function createDemoBatchImages(
  selectedModelImage: string,
  sceneSelections: DemoSceneSelection[],
): Promise<string[]> {
  const image = await loadImage(selectedModelImage);

  return Promise.all(
    sceneSelections.map(async (scene, index) => {
      const { canvas, context } = createCanvas(1080, 1440);
      drawBackdrop(context, canvas.width, canvas.height, `${scene.templateId}-${index}`);
      drawTitle(context, scene.templateId, `${scene.framing} · ${scene.facing} · 演示模式`, canvas.width);
      drawHeroImage(context, image, { x: 88, y: 210, width: 904, height: 1060 });
      drawBadge(context, `场景 ${index + 1}`, 88, 1320, '#EA580C');
      return canvasToDataUrl(canvas);
    })
  );
}

export async function createDemoCutoutBlob(file: File): Promise<Blob> {
  const image = await loadImageFromFile(file);
  const { canvas, context } = createCanvas(image.naturalWidth || 1200, image.naturalHeight || 1200);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;

  for (let index = 0; index < data.length; index += 4) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const brightness = (red + green + blue) / 3;
    const spread = Math.max(red, green, blue) - Math.min(red, green, blue);

    if (brightness > 245 && spread < 18) {
      data[index + 3] = 0;
      continue;
    }

    if (brightness > 228 && spread < 30) {
      const alpha = Math.max(0, Math.min(255, (255 - (brightness - 228) * 10)));
      data[index + 3] = Math.min(data[index + 3], alpha);
    }
  }

  context.putImageData(imageData, 0, 0);
  return canvasToBlob(canvas);
}