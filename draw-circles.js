function drawCircle(ctx, x, y, radius, color = 'red', lineWidth = 2) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

function drawCircles(ctx, circles) {
  circles.forEach((circle) => {
    drawCircle(
      ctx,
      circle.x,
      circle.y,
      circle.radius,
      circle.color || 'red',
      circle.lineWidth || 2
    );
  });
}

function createCircleArt(canvasId, circles) {
  const canvas = document.getElementById(canvasId);

  if (!canvas) {
    throw new Error(`לא נמצא קנבס עם id: ${canvasId}`);
  }

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawCircles(ctx, circles);
}

const exampleCircles = [
  { x: 80, y: 80, radius: 40, color: '#ff6b6b' },
  { x: 170, y: 90, radius: 30, color: '#ffd93d' },
  { x: 250, y: 80, radius: 50, color: '#6bc4ff' },
  { x: 130, y: 170, radius: 25, color: '#8b5cf6' }
];

window.addEventListener('DOMContentLoaded', () => {
  createCircleArt('circleCanvas', exampleCircles);
});
