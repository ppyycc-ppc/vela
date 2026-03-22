//代码归属于米坛社区 @ppyycc 。
//部分内容（主要为物理碰撞检测与处理）由 DeepSeek、Gemini、ChatGPT4.5 等生成式 AI 辅助。


// ==================== 可配置常量 ====================
export const PHYSICS_CONFIG = {
  GRAVITY: 0.2,                       //重力加速度，调整水果下落加速度
  COLLIDE_DIST_FACTOR: 1,        // 轻微提前检测，减少穿透
  BOUNCE: 0.1,                      // 降低弹性，提升堆积刚性
  BOUNDARY_BOUNCE: 0.1,             // 边界轻微反弹，防粘边
  MAX_SPEED: 10,                     // 限制最大速度，避免高速穿透
  ITERATIONS: 1,                    // 每帧碰撞解析次数（核心防穿透）
};

// 水果类型定义（半径、颜色、下一级索引、分数）
export const FRUIT_TYPES = [
  { name: "Grape", radius: 15, color: "#4388AA", next: 1, score: 5 },
  { name: "Cherry", radius: 15, color: "#7F1937", next: 2, score: 10 },
  { name: "Orange", radius: 35, color: "#E88657", next: 3, score: 15 },
  { name: "Lemon", radius: 35, color: "#B0D925", next: 4, score: 20 },
  { name: "Kiwi", radius: 55, color: "#E06464", next: 5, score: 30 },
  { name: "Tomato", radius: 55, color: "#BC2F42", next: 6, score: 80 },
  { name: "Peach", radius: 70, color: "#A8AE18", next: 7, score: 100 },
  { name: "Pineapple", radius: 70, color: "#D3D856", next: 8, score: 120 },
  { name: "Coconut", radius: 100, color: "#CCCCCC", next: 9, score: 160 },
  { name: "Watermelon", radius: 100, color: "#CF323C", next: 11, score: 200 },
  { name: "BigWatermelon", radius: 100, color: "#CF323C", next: null, score: 400 },
  { name: "NULL", radius: 0, color: "rgba(255, 255, 255, 0)", next: null, score: 0 },//第11个为空，不能创建
];

// ==================== 数据模型 ====================
export function createFruit(x, y, type, vx = 0, vy = 0) {
  if(type==11)return;
  return {
    x, y, vx, vy,
    type: type,
    color: FRUIT_TYPES[type].color,
    radius: FRUIT_TYPES[type].radius,
    name: FRUIT_TYPES[type].name
  };
}

// ==================== 重力与速度更新 ====================
export function applyPhysics(fruit) {
  fruit.vy += PHYSICS_CONFIG.GRAVITY;
  fruit.x += fruit.vx;
  fruit.y += fruit.vy;

  // 速度限制，防止穿透
  fruit.vx = Math.min(Math.max(fruit.vx, -PHYSICS_CONFIG.MAX_SPEED), PHYSICS_CONFIG.MAX_SPEED);
  fruit.vy = Math.min(Math.max(fruit.vy, -PHYSICS_CONFIG.MAX_SPEED), PHYSICS_CONFIG.MAX_SPEED);
}

// ==================== 边界处理（修正为正确半径）====================
export function applyBoundary(fruit, boardWidth, boardHeight) {
  const r = fruit.radius;
  let gameOver = false;

  // 左右边界（使用实际半径）
  if (fruit.x - r < 0) {
    fruit.x = r;
    fruit.vx = -fruit.vx * PHYSICS_CONFIG.BOUNDARY_BOUNCE;
    if (Math.abs(fruit.vx) < 0.5) fruit.vx = 0;
  }
  if (fruit.x + r > boardWidth) {
    fruit.x = boardWidth - r;
    fruit.vx = -fruit.vx * PHYSICS_CONFIG.BOUNDARY_BOUNCE;
    if (Math.abs(fruit.vx) < 0.5) fruit.vx = 0;
  }

  // 底部边界
  if (fruit.y + r > boardHeight) {
    fruit.y = boardHeight - r;
    fruit.vy = -fruit.vy * PHYSICS_CONFIG.BOUNDARY_BOUNCE;
    if (Math.abs(fruit.vy) < 0.5) fruit.vy = 0;
  }

  // 顶部溢出判定（游戏结束）
  if (fruit.y - r < 40) gameOver = true;

  // 最终钳位（保证不越界）
  fruit.x = Math.min(Math.max(fruit.x, r), boardWidth - r);
  fruit.y = Math.min(Math.max(fruit.y, r), boardHeight - r);

  return gameOver;
}

// ==================== 碰撞检测与响应（核心改进）====================
function isColliding(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const minDist = (a.radius + b.radius) * PHYSICS_CONFIG.COLLIDE_DIST_FACTOR;
  return dx * dx + dy * dy < minDist * minDist;
}

function resolveCollision(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dist = Math.hypot(dx, dy);
  if (dist === 0) return;

  const minDist = (a.radius + b.radius) * PHYSICS_CONFIG.COLLIDE_DIST_FACTOR;
  const overlap = minDist - dist;
  if (overlap <= 0) return;

  // 位置修正（推开）
  const angle = Math.atan2(dy, dx);
  const pushX = Math.cos(angle) * overlap * 0.5;
  const pushY = Math.sin(angle) * overlap * 0.5;
  a.x += pushX;
  a.y += pushY;
  b.x -= pushX;
  b.y -= pushY;

  // 速度响应（法线方向速度交换）
  const nx = dx / dist;
  const ny = dy / dist;
  const vrelx = a.vx - b.vx;
  const vrely = a.vy - b.vy;
  const velAlong = vrelx * nx + vrely * ny;
  if (velAlong < 0) {
    const e = PHYSICS_CONFIG.BOUNCE;
    const imp = (1 + e) * velAlong / 2;
    a.vx -= imp * nx;
    a.vy -= imp * ny;
    b.vx += imp * nx;
    b.vy += imp * ny;
  }
}

function mergeFruits(a, b, onScore) {
  if (a.type !== b.type) return null;
  const nextType = FRUIT_TYPES[a.type].next;
  if (nextType === null) {
    if (onScore) onScore(FRUIT_TYPES[a.type].score * 0.5);
    return null;
  }
  const midX = (a.x + b.x) / 2;
  const midY = (a.y + b.y) / 2;
  const newVx = (a.vx + b.vx) / 2;
  const newVy = (a.vy + b.vy) / 2;
  if (onScore) onScore(FRUIT_TYPES[a.type].score * 2);
  return createFruit(midX, midY, nextType, newVx, newVy);
}

// ==================== 空间网格加速（保持原有结构）====================
class SpatialGrid {
  constructor(cellSize, w, h) {
    this.cellSize = cellSize;
    this.cols = Math.ceil(w / cellSize) + 1;
    this.rows = Math.ceil(h / cellSize) + 1;
    this.grid = Array(this.cols * this.rows).fill().map(() => []);
  }
  clear() { this.grid.forEach(cell => cell.length = 0); }
  getCellIdx(x, y) {
    const col = Math.floor(x / this.cellSize);
    const row = Math.floor(y / this.cellSize);
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return -1;
    return row * this.cols + col;
  }
  insert(f) {
    const idx = this.getCellIdx(f.x, f.y);
    if (idx !== -1) this.grid[idx].push(f);
  }
  getCandidates(f) {
    const cx = Math.floor(f.x / this.cellSize);
    const cy = Math.floor(f.y / this.cellSize);
    const candidates = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const col = cx + dx, row = cy + dy;
        if (col >= 0 && col < this.cols && row >= 0 && row < this.rows) {
          candidates.push(...this.grid[row * this.cols + col]);
        }
      }
    }
    return candidates;
  }
}

// ==================== 迭代解析核心 ====================
function resolveAllCollisions(fruits, boardWidth, boardHeight, onScore, onMerge) {
  let anyMerged = false;
  let newFruitsNames = [];  // 收集新水果名称

  // 循环检测，直到没有合并发生或达到迭代上限
  for (let iter = 0; iter < PHYSICS_CONFIG.ITERATIONS; iter++) {
    let mergedThisPass = false;

    // 使用暴力检测（简单场景，可优化为网格，但数量少时直接暴力）
    for (let i = 0; i < fruits.length; i++) {
      for (let j = i + 1; j < fruits.length; j++) {
        const a = fruits[i], b = fruits[j];
        if (!isColliding(a, b)) continue;

        if (a.type === b.type && FRUIT_TYPES[a.type].next !== null) {
          const newFruit = mergeFruits(a, b, onScore);
          if (newFruit) {
            // 移除旧水果，添加新水果
            fruits.splice(j, 1);
            fruits.splice(i, 1);
            fruits.push(newFruit);
            mergedThisPass = true;
            anyMerged = true;
            newFruitsNames.push(newFruit.name);  // 收集名称
            if (onMerge) onMerge(newFruit, a, b);
            // 由于数组已变，需重置循环
            break;
          } else {
            fruits.splice(j, 1);
            fruits.splice(i, 1);
            mergedThisPass = true;
            anyMerged = true;
            break;
          }
        } else {
          resolveCollision(a, b);
        }
      }
      if (mergedThisPass) break; // 重新开始检测
    }

    // 如果没有合并发生，后续迭代只处理位置修正，可以提前退出
    if (!mergedThisPass) break;
  }
  
  // 返回合并状态和新水果名称列表
  return { merged: anyMerged, newFruitsNames };
}

// ==================== 对外接口（保持原有调用方式）====================
export function handleCollisions(fruits, options = {}) {
  const {
    boardWidth = 360,
    boardHeight = 640,
    onMerge = null,
    onScore = null,
  } = options;

  // 直接调用迭代解析器，返回包含 merged 和 newFruitsNames 的对象
  return resolveAllCollisions(fruits, boardWidth, boardHeight, onScore, onMerge);
}