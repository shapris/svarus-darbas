/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Performance monitoring utilities
export class PerformanceMonitor {
  private static metrics: Map<string, number[]> = new Map();

  static startTimer(name: string): () => void {
    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      this.recordMetric(name, duration);
    };
  }

  static recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(value);
    
    // Keep only last 100 measurements
    const values = this.metrics.get(name)!;
    if (values.length > 100) {
      values.shift();
    }
  }

  static getAverageMetric(name: string): number {
    const values = this.metrics.get(name);
    if (!values || values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  static getMetrics(): Record<string, { avg: number; count: number }> {
    const result: Record<string, { avg: number; count: number }> = {};
    
    this.metrics.forEach((values, name) => {
      result[name] = {
        avg: values.reduce((sum, v) => sum + v, 0) / values.length,
        count: values.length
      };
    });
    
    return result;
  }
}

// Memoization utility
export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  keyGenerator?: (...args: Parameters<T>) => string
): T {
  const cache = new Map<string, ReturnType<T>>();
  
  return ((...args: Parameters<T>) => {
    const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);
    
    if (cache.has(key)) {
      return cache.get(key);
    }
    
    const result = fn(...args);
    cache.set(key, result);
    
    // Limit cache size
    if (cache.size > 1000) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
    
    return result;
  }) as T;
}

// Debounce utility
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

// Throttle utility
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      fn(...args);
    }
  };
}

// Virtual scrolling helper
export class VirtualScroller {
  private containerHeight: number;
  private itemHeight: number;
  private scrollTop: number = 0;
  private totalCount: number;

  constructor(containerHeight: number, itemHeight: number, totalCount: number) {
    this.containerHeight = containerHeight;
    this.itemHeight = itemHeight;
    this.totalCount = totalCount;
  }

  setScrollTop(scrollTop: number): void {
    this.scrollTop = scrollTop;
  }

  getVisibleRange(): { start: number; end: number; offsetY: number } {
    const start = Math.floor(this.scrollTop / this.itemHeight);
    const visibleCount = Math.ceil(this.containerHeight / this.itemHeight);
    const end = Math.min(start + visibleCount + 1, this.totalCount);
    const offsetY = start * this.itemHeight;
    
    return { start, end, offsetY };
  }

  getTotalHeight(): number {
    return this.totalCount * this.itemHeight;
  }
}

// Lazy loading utility
export class LazyLoader {
  private observer: IntersectionObserver;
  private callbacks: Map<Element, () => void> = new Map();

  constructor() {
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const callback = this.callbacks.get(entry.target);
            if (callback) {
              callback();
              this.observer.unobserve(entry.target);
              this.callbacks.delete(entry.target);
            }
          }
        });
      },
      { rootMargin: '50px' }
    );
  }

  observe(element: Element, callback: () => void): void {
    this.callbacks.set(element, callback);
    this.observer.observe(element);
  }

  unobserve(element: Element): void {
    this.observer.unobserve(element);
    this.callbacks.delete(element);
  }

  disconnect(): void {
    this.observer.disconnect();
    this.callbacks.clear();
  }
}

// Image optimization
export function optimizeImage(src: string, options: {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'avif' | 'jpeg' | 'png';
}): string {
  const params = new URLSearchParams();
  
  if (options.width) params.set('w', options.width.toString());
  if (options.height) params.set('h', options.height.toString());
  if (options.quality) params.set('q', options.quality.toString());
  if (options.format) params.set('f', options.format);
  
  const paramString = params.toString();
  return paramString ? `${src}?${paramString}` : src;
}

// Bundle size analyzer
export class BundleAnalyzer {
  static analyze(): {
    totalSize: number;
    chunkSizes: Record<string, number>;
    recommendations: string[];
  } {
    // This would typically be done at build time
    // Here we provide runtime estimates
    const recommendations: string[] = [];
    
    // Check if performance is poor
    const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
    if (loadTime > 3000) {
      recommendations.push('Consider lazy loading heavy components');
    }
    
    const perf = performance as Performance & {
      memory?: { usedJSHeapSize: number; totalJSHeapSize: number };
    };
    if (perf.memory) {
      const usedMemory = perf.memory.usedJSHeapSize;
      const totalMemory = perf.memory.totalJSHeapSize;
      
      if (usedMemory / totalMemory > 0.8) {
        recommendations.push('Memory usage is high, consider cleanup');
      }
    }
    
    return {
      totalSize: 0, // Would be calculated from actual bundle
      chunkSizes: {},
      recommendations
    };
  }
}

// Request batching
export class RequestBatcher<T> {
  private batch: T[] = [];
  private batchTimeout: NodeJS.Timeout | null = null;
  private readonly batchSize: number;
  private readonly batchDelay: number;
  private readonly processor: (batch: T[]) => Promise<void>;

  constructor(
    batchSize: number,
    batchDelay: number,
    processor: (batch: T[]) => Promise<void>
  ) {
    this.batchSize = batchSize;
    this.batchDelay = batchDelay;
    this.processor = processor;
  }

  add(item: T): void {
    this.batch.push(item);
    
    if (this.batch.length >= this.batchSize) {
      this.flush();
    } else if (!this.batchTimeout) {
      this.batchTimeout = setTimeout(() => this.flush(), this.batchDelay);
    }
  }

  private async flush(): Promise<void> {
    if (this.batch.length === 0) return;
    
    const batch = this.batch.splice(0);
    
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
    
    try {
      await this.processor(batch);
    } catch (error) {
      console.error('Batch processing failed:', error);
    }
  }

  flushNow(): void {
    this.flush();
  }
}

// Cache manager
export class CacheManager<T> {
  private cache: Map<string, { value: T; timestamp: number; ttl: number }> = new Map();
  private readonly defaultTTL: number;

  constructor(defaultTTL: number = 5 * 60 * 1000) { // 5 minutes default
    this.defaultTTL = defaultTTL;
  }

  set(key: string, value: T, ttl?: number): void {
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL
    });
  }

  get(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) return null;
    
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  cleanup(): void {
    const now = Date.now();
    
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.ttl) {
        this.cache.delete(key);
      }
    }
  }

  size(): number {
    return this.cache.size;
  }
}

// Performance monitoring hook
export function usePerformanceMonitor(componentName: string) {
  const startRender = () => PerformanceMonitor.startTimer(`${componentName}_render`);
  const startMount = () => PerformanceMonitor.startTimer(`${componentName}_mount`);
  
  return {
    startRender,
    startMount,
    getMetrics: () => PerformanceMonitor.getAverageMetric(`${componentName}_render`)
  };
}

// Resource loading optimizer
export class ResourceOptimizer {
  private static loadedScripts = new Set<string>();
  private static loadedStyles = new Set<string>();

  static async loadScript(src: string): Promise<void> {
    if (this.loadedScripts.has(src)) return;
    
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      
      script.onload = () => {
        this.loadedScripts.add(src);
        resolve();
      };
      
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  static async loadStyle(href: string): Promise<void> {
    if (this.loadedStyles.has(href)) return;
    
    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      
      link.onload = () => {
        this.loadedStyles.add(href);
        resolve();
      };
      
      link.onerror = reject;
      document.head.appendChild(link);
    });
  }

  static preloadResource(href: string, as: string): void {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = href;
    link.as = as;
    document.head.appendChild(link);
  }
}
