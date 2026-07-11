import sys

with open('summary.html', 'r', encoding='utf-8') as f:
    content = f.read()

old_viewer = """<!-- PDF Canvas Area -->
<div class="flex-1 bg-surface-container-low overflow-hidden relative flex flex-row">
<div class="absolute inset-0 opacity-5 pointer-events-none" style="background-image: radial-gradient(#0050cb 1px, transparent 1px); background-size: 20px 20px;"></div>

<!-- Pages Slider (Right side in RTL) -->
<div id="pages-slider-container" class="hidden w-[140px] shrink-0 border-l border-outline-variant/30 bg-surface-container-lowest/80 backdrop-blur-sm flex-col relative z-10 shadow-[4px_0_15px_-3px_rgba(0,0,0,0.05)]">
  <div class="relative group flex-1 flex flex-col items-center py-4 h-full">
    <button id="pages-prev" class="flex z-10 w-8 h-8 rounded-full bg-surface-container-lowest/90 backdrop-blur border border-outline-variant/30 shadow-md items-center justify-center text-on-surface-variant hover:text-primary hover:border-primary/30 transition-all mb-2 shrink-0" aria-label="السابق">
      <span class="material-symbols-outlined text-[18px]">keyboard_arrow_up</span>
    </button>
    <div id="pages-slider" class="flex flex-col gap-4 overflow-y-auto snap-y snap-mandatory scroll-smooth custom-scrollbar px-2 w-full items-center flex-1">
    </div>
    <button id="pages-next" class="flex z-10 w-8 h-8 rounded-full bg-surface-container-lowest/90 backdrop-blur border border-outline-variant/30 shadow-md items-center justify-center text-on-surface-variant hover:text-primary hover:border-primary/30 transition-all mt-2 shrink-0" aria-label="التالي">
      <span class="material-symbols-outlined text-[18px]">keyboard_arrow_down</span>
    </button>
  </div>
</div>

<!-- Main Viewer Content -->
<div class="flex-1 overflow-y-auto no-scrollbar p-sm md:p-md relative">
<div id="pdf-container" class="w-full max-w-[800px] mx-auto flex flex-col items-center gap-4 py-8">
<div id="pdf-placeholder" class="w-full aspect-[1/1.414] pdf-page-shadow rounded-sm flex items-center justify-center border border-outline-variant/10 bg-white">
<div class="text-center p-8 opacity-40">
<span class="material-symbols-outlined text-[64px] text-outline mb-4">description</span>
<h2 class="font-headline-md text-headline-md text-on-surface-variant">لا يوجد مستند</h2>
<p class="font-body-md text-body-md text-on-surface-variant mt-2">لم يتم رفع ملف PDF لهذا الملخص بعد.</p>
</div>
</div>
<canvas id="pdf-canvas" class="pdf-page-shadow rounded-sm hidden" style="max-width: 100%; height: auto;"></canvas>
<img id="image-page" class="pdf-page-shadow rounded-sm hidden max-w-full h-auto bg-white transition-transform origin-top" alt="صفحة الملخص" loading="lazy">
</div>
</div>

</div>"""

new_viewer = """<!-- PDF Canvas Area -->
<div class="flex-1 bg-surface-container-low overflow-hidden relative flex flex-col">
<div class="absolute inset-0 opacity-5 pointer-events-none" style="background-image: radial-gradient(#0050cb 1px, transparent 1px); background-size: 20px 20px;"></div>

<!-- Main Viewer Content -->
<div class="flex-1 overflow-y-auto no-scrollbar p-sm md:p-md relative flex justify-center">
  <div class="flex flex-row max-w-[1000px] w-full gap-4 md:gap-8 relative">
    
    <!-- Pages Slider (Right side in RTL) -->
    <div id="pages-slider-container" class="hidden w-[120px] shrink-0 flex-col py-8 z-10">
      <div class="sticky top-8 flex flex-col items-center w-full" style="max-height: calc(100vh - 250px);">
        <button id="pages-prev" class="flex z-10 w-8 h-8 rounded-full bg-surface-container-lowest/90 backdrop-blur border border-outline-variant/30 shadow-md items-center justify-center text-on-surface-variant hover:text-primary hover:border-primary/30 transition-all mb-2 shrink-0" aria-label="السابق">
          <span class="material-symbols-outlined text-[18px]">keyboard_arrow_up</span>
        </button>
        <div id="pages-slider" class="flex flex-col gap-4 overflow-y-auto snap-y snap-mandatory scroll-smooth custom-scrollbar px-2 w-full items-center flex-1">
        </div>
        <button id="pages-next" class="flex z-10 w-8 h-8 rounded-full bg-surface-container-lowest/90 backdrop-blur border border-outline-variant/30 shadow-md items-center justify-center text-on-surface-variant hover:text-primary hover:border-primary/30 transition-all mt-2 shrink-0" aria-label="التالي">
          <span class="material-symbols-outlined text-[18px]">keyboard_arrow_down</span>
        </button>
      </div>
    </div>

    <!-- PDF/Image Container -->
    <div id="pdf-container" class="flex-1 w-full mx-auto flex flex-col items-center gap-4 py-8">
      <div id="pdf-placeholder" class="w-full aspect-[1/1.414] pdf-page-shadow rounded-sm flex items-center justify-center border border-outline-variant/10 bg-white">
        <div class="text-center p-8 opacity-40">
          <span class="material-symbols-outlined text-[64px] text-outline mb-4">description</span>
          <h2 class="font-headline-md text-headline-md text-on-surface-variant">لا يوجد مستند</h2>
          <p class="font-body-md text-body-md text-on-surface-variant mt-2">لم يتم رفع ملف PDF لهذا الملخص بعد.</p>
        </div>
      </div>
      <canvas id="pdf-canvas" class="pdf-page-shadow rounded-sm hidden" style="max-width: 100%; height: auto;"></canvas>
      <img id="image-page" class="pdf-page-shadow rounded-sm hidden max-w-full h-auto bg-white transition-transform origin-top" alt="صفحة الملخص" loading="lazy">
    </div>
    
  </div>
</div>

</div>"""

if old_viewer in content:
    content = content.replace(old_viewer, new_viewer)
    with open('summary.html', 'w', encoding='utf-8') as f:
        f.write(content)
    print("SUCCESS")
else:
    print("FAILED TO MATCH")
