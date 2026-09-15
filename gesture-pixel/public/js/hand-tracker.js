/**
 * HandTracker - 手部追踪模块
 * 使用 MediaPipe Hands 进行实时手势识别
 *
 * @requires MediaPipe Hands (通过 CDN 加载)
 * @example
 * const tracker = new HandTracker(videoElement);
 * tracker.onHandDetected(({ landmarks, isOpen, palmCenter }) => {
 *   console.log('手势状态:', isOpen ? '张开' : '握拳');
 * });
 * tracker.start();
 */

class HandTracker {
  /**
   * @param {HTMLVideoElement} videoElement - 用于显示摄像头画面的视频元素
   * @param {Object} options - 配置选项
   * @param {number} options.width - 视频宽度 (默认 480)
   * @param {number} options.height - 视频高度 (默认 360)
   * @param {number} options.openThreshold - 手势张开的阈值 (默认 0.15)
   */
  constructor(videoElement, options = {}) {
    if (!videoElement || videoElement.tagName !== 'VIDEO') {
      throw new Error('HandTracker: 需要一个有效的 video 元素');
    }

    this.video = videoElement;
    this.width = options.width || 480;
    this.height = options.height || 360;
    this.openThreshold = options.openThreshold || 0.15;

    // MediaPipe 实例
    this.hands = null;
    this.camera = null;
    this.isRunning = false;

    // 回调函数列表
    this.callbacks = [];

    // 手部关键点索引常量
    this.FINGERTIP_INDICES = [4, 8, 12, 16, 20]; // 拇指尖、食指尖、中指尖、无名指尖、小指尖
    this.WRIST_INDEX = 0;
    this.MIDDLE_FINGER_BASE_INDEX = 9; // 中指根部
  }

  /**
   * 注册手部检测回调
   * @param {Function} callback - 回调函数，接收 { landmarks, isOpen, palmCenter }
   * @returns {Function} 取消注册的函数
   */
  onHandDetected(callback) {
    if (typeof callback !== 'function') {
      throw new Error('onHandDetected: callback 必须是函数');
    }

    this.callbacks.push(callback);

    // 返回取消注册函数
    return () => {
      const index = this.callbacks.indexOf(callback);
      if (index > -1) {
        this.callbacks.splice(index, 1);
      }
    };
  }

  /**
   * 初始化 MediaPipe Hands
   * @private
   */
  _initMediaPipe() {
    // 检查 MediaPipe 是否已加载
    if (typeof Hands === 'undefined' || typeof Camera === 'undefined') {
      throw new Error(
        'HandTracker: MediaPipe 未加载。请确保已引入以下脚本:\n' +
        '<script src="https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js"></script>\n' +
        '<script src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js"></script>'
      );
    }

    // 创建 Hands 实例
    this.hands = new Hands({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
      }
    });

    // 配置 Hands 参数
    this.hands.setOptions({
      maxNumHands: 1,           // 只追踪一只手
      modelComplexity: 1,       // 模型复杂度 (0 或 1)
      minDetectionConfidence: 0.7,  // 最小检测置信度
      minTrackingConfidence: 0.5    // 最小追踪置信度
    });

    // 设置结果处理回调
    this.hands.onResults(this._onResults.bind(this));
  }

  /**
   * 处理 MediaPipe 检测结果
   * @private
   * @param {Object} results - MediaPipe 检测结果
   */
  _onResults(results) {
    // 如果没有检测到手部，不触发回调
    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      return;
    }

    const landmarks = results.multiHandLandmarks[0]; // 取第一只手

    // 归一化关键点坐标 (MediaPipe 已经是 0-1 范围)
    const normalizedLandmarks = landmarks.map(lm => ({
      x: lm.x,
      y: lm.y,
      z: lm.z
    }));

    // 计算手掌中心
    const palmCenter = this._calculatePalmCenter(normalizedLandmarks);

    // 检测手势是否张开
    const isOpen = this._isHandOpen(normalizedLandmarks);

    // 触发所有回调
    const handData = {
      landmarks: normalizedLandmarks,
      isOpen,
      palmCenter
    };

    this.callbacks.forEach(cb => {
      try {
        cb(handData);
      } catch (err) {
        console.error('HandTracker 回调执行错误:', err);
      }
    });
  }

  /**
   * 计算手掌中心点
   * @private
   * @param {Array} landmarks - 归一化的关键点数组
   * @returns {Object} { x, y } 手掌中心坐标
   */
  _calculatePalmCenter(landmarks) {
    const wrist = landmarks[this.WRIST_INDEX];
    const middleBase = landmarks[this.MIDDLE_FINGER_BASE_INDEX];

    return {
      x: (wrist.x + middleBase.x) / 2,
      y: (wrist.y + middleBase.y) / 2
    };
  }

  /**
   * 检测手掌是否张开
   * @private
   * @param {Array} landmarks - 归一化的关键点数组
   * @returns {boolean} 手掌是否张开
   */
  _isHandOpen(landmarks) {
    const wrist = landmarks[this.WRIST_INDEX];

    // 计算每个指尖到手腕的距离
    const distances = this.FINGERTIP_INDICES.map(tipIndex => {
      const tip = landmarks[tipIndex];
      return this._calculateDistance(wrist, tip);
    });

    // 计算平均距离
    const avgDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length;

    // 与阈值比较
    return avgDistance > this.openThreshold;
  }

  /**
   * 计算两点之间的欧氏距离
   * @private
   * @param {Object} p1 - 点1 { x, y }
   * @param {Object} p2 - 点2 { x, y }
   * @returns {number} 距离值
   */
  _calculateDistance(p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * 初始化摄像头
   * @private
   * @returns {Promise<void>}
   */
  async _initCamera() {
    // 设置视频元素属性
    this.video.width = this.width;
    this.video.height = this.height;
    this.video.style.transform = 'scaleX(-1)'; // 镜像显示

    // 创建 Camera 实例
    this.camera = new Camera(this.video, {
      onFrame: async () => {
        if (this.hands && this.isRunning) {
          await this.hands.send({ image: this.video });
        }
      },
      width: this.width,
      height: this.height,
      facingMode: 'user' // 前置摄像头
    });
  }

  /**
   * 启动手部追踪
   * @returns {Promise<void>}
   */
  async start() {
    if (this.isRunning) {
      console.warn('HandTracker: 已在运行中');
      return;
    }

    try {
      // 初始化 MediaPipe (如果尚未初始化)
      if (!this.hands) {
        this._initMediaPipe();
      }

      // 初始化摄像头 (如果尚未初始化)
      if (!this.camera) {
        await this._initCamera();
      }

      // 启动摄像头
      await this.camera.start();
      this.isRunning = true;

      console.log('HandTracker: 手部追踪已启动');
    } catch (err) {
      // 处理摄像头权限错误
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        throw new Error(
          'HandTracker: 摄像头权限被拒绝。请在浏览器设置中允许摄像头访问。'
        );
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        throw new Error(
          'HandTracker: 未找到摄像头设备。请确保设备已连接摄像头。'
        );
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        throw new Error(
          'HandTracker: 摄像头被其他应用占用。请关闭其他使用摄像头的应用。'
        );
      } else {
        throw new Error(`HandTracker: 启动失败 - ${err.message}`);
      }
    }
  }

  /**
   * 停止手部追踪
   */
  stop() {
    if (!this.isRunning) {
      console.warn('HandTracker: 未在运行');
      return;
    }

    if (this.camera) {
      this.camera.stop();
    }

    this.isRunning = false;
    console.log('HandTracker: 手部追踪已停止');
  }

  /**
   * 完全销毁实例，释放资源
   */
  destroy() {
    this.stop();

    if (this.hands) {
      this.hands.close();
      this.hands = null;
    }

    this.camera = null;
    this.callbacks = [];

    console.log('HandTracker: 实例已销毁');
  }

  /**
   * 获取当前运行状态
   * @returns {boolean}
   */
  get running() {
    return this.isRunning;
  }
}

// 导出（支持模块化和全局访问）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HandTracker;
} else {
  window.HandTracker = HandTracker;
}
