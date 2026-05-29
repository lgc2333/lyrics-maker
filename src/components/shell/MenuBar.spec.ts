import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import MenuBar from './MenuBar.vue'

describe('menuBar', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('opens file menu on click and closes on second click', async () => {
    const wrapper = mount(MenuBar, {
      props: { mode: 'timing', theme: 'light', audioLoaded: true },
    })
    await wrapper.get('[data-testid="menu-trigger-file"]').trigger('click')
    expect(wrapper.find('[data-testid="menu-popup-file"]').exists()).toBe(true)
    await wrapper.get('[data-testid="menu-trigger-file"]').trigger('click')
    expect(wrapper.find('[data-testid="menu-popup-file"]').exists()).toBe(false)
  })

  it('emits switch-mode when lyrics mode button clicked', async () => {
    const wrapper = mount(MenuBar, {
      props: { mode: 'timing', theme: 'light', audioLoaded: true },
    })
    await wrapper.get('[data-testid="mode-switch-lyrics"]').trigger('click')
    expect(wrapper.emitted('switchMode')?.[0]).toEqual(['lyrics'])
  })

  it('emits switch-mode when timing mode button clicked', async () => {
    const wrapper = mount(MenuBar, {
      props: { mode: 'lyrics', theme: 'light', audioLoaded: true },
    })
    await wrapper.get('[data-testid="mode-switch-timing"]').trigger('click')
    expect(wrapper.emitted('switchMode')?.[0]).toEqual(['timing'])
  })

  it('has theme menu button', () => {
    const wrapper = mount(MenuBar, {
      props: {
        mode: 'timing',
        themeMode: 'light',
        effectiveTheme: 'light',
        audioLoaded: true,
      },
    })
    expect(wrapper.find('[data-testid="theme-toggle"]').exists()).toBe(true)
  })

  it('uses left-menu center-title right-controls layout', () => {
    const wrapper = mount(MenuBar, {
      props: { mode: 'timing', theme: 'light', audioLoaded: true },
    })
    expect(wrapper.find('[data-testid="menu-left"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-title"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-right"]').exists()).toBe(true)
  })

  it('renders mode switch in segmented switch style container', () => {
    const wrapper = mount(MenuBar, {
      props: { mode: 'timing', theme: 'light', audioLoaded: true },
    })
    expect(wrapper.find('[data-testid="mode-switch-group"]').exists()).toBe(true)
  })

  it('opens theme menu and emits selected theme mode', async () => {
    const wrapper = mount(MenuBar, {
      props: {
        mode: 'timing',
        themeMode: 'system',
        effectiveTheme: 'dark',
        audioLoaded: true,
      },
    })
    await wrapper.get('[data-testid="theme-toggle"]').trigger('click')
    expect(wrapper.find('[data-testid="menu-popup-theme"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="theme-option-system"]').classes()).toContain(
      'bg-base-200',
    )

    await wrapper.get('[data-testid="theme-option-light"]').trigger('click')

    expect(wrapper.emitted('updateThemeMode')?.[0]).toEqual(['light'])
    expect(wrapper.find('[data-testid="menu-popup-theme"]').exists()).toBe(false)
  })

  it('closes open menu when clicking another menu trigger', async () => {
    const wrapper = mount(MenuBar, {
      props: { mode: 'timing', theme: 'light', audioLoaded: true },
    })
    await wrapper.get('[data-testid="menu-trigger-file"]').trigger('click')
    expect(wrapper.find('[data-testid="menu-popup-file"]').exists()).toBe(true)
    await wrapper.get('[data-testid="menu-trigger-edit"]').trigger('click')
    expect(wrapper.find('[data-testid="menu-popup-file"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="menu-popup-edit"]').exists()).toBe(true)
  })

  it('switches open top-level menu on hover', async () => {
    const wrapper = mount(MenuBar, {
      props: { mode: 'timing', theme: 'light', audioLoaded: true },
    })
    await wrapper.get('[data-testid="menu-trigger-file"]').trigger('click')
    expect(wrapper.find('[data-testid="menu-popup-file"]').exists()).toBe(true)

    await wrapper.get('[data-testid="menu-trigger-help"]').trigger('mouseenter')

    expect(wrapper.find('[data-testid="menu-popup-file"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="menu-popup-help"]').exists()).toBe(true)
  })

  it('closes menu on click outside', async () => {
    const wrapper = mount(MenuBar, {
      props: { mode: 'timing', theme: 'light', audioLoaded: true },
    })
    await wrapper.get('[data-testid="menu-trigger-file"]').trigger('click')
    expect(wrapper.find('[data-testid="menu-popup-file"]').exists()).toBe(true)
    // Click on body — should close the menu since it's outside menu triggers/popups
    document.body.click()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="menu-popup-file"]').exists()).toBe(false)
  })

  it('emits openAudioFile from file menu action', async () => {
    const wrapper = mount(MenuBar, {
      props: { mode: 'timing', theme: 'light', audioLoaded: true },
    })
    await wrapper.get('[data-testid="menu-trigger-file"]').trigger('click')
    await wrapper.get('[data-testid="menu-open-audio"]').trigger('click')
    expect(wrapper.emitted('openAudioFile')).toHaveLength(1)
  })

  it('renders reorganized file menu items with future actions disabled', async () => {
    const wrapper = mount(MenuBar, {
      props: { mode: 'timing', theme: 'light', audioLoaded: true },
    })

    await wrapper.get('[data-testid="menu-trigger-file"]').trigger('click')

    expect(wrapper.get('[data-testid="menu-new-project"]').text()).toContain('新建项目')
    expect(wrapper.get('[data-testid="menu-open-project"]').text()).toContain(
      '打开工程',
    )
    expect(wrapper.get('[data-testid="menu-open-audio"]').text()).toContain('导入音乐')
    expect(wrapper.get('[data-testid="menu-save-project"]').text()).toContain(
      '保存项目',
    )
    expect(wrapper.get('[data-testid="menu-save-as"]').text()).toContain('项目另存为')
    expect(wrapper.get('[data-testid="menu-preferences"]').text()).toContain('首选项')
    expect(
      (wrapper.get('[data-testid="menu-new-project"]').element as HTMLButtonElement)
        .disabled,
    ).toBe(false)
    expect(
      (wrapper.get('[data-testid="menu-open-project"]').element as HTMLButtonElement)
        .disabled,
    ).toBe(false)
    expect(
      (wrapper.get('[data-testid="menu-preferences"]').element as HTMLButtonElement)
        .disabled,
    ).toBe(false)
  })

  it('emits openPreferences from the file menu', async () => {
    const wrapper = mount(MenuBar, {
      props: { mode: 'timing', theme: 'light', audioLoaded: true },
    })

    await wrapper.get('[data-testid="menu-trigger-file"]').trigger('click')
    await wrapper.get('[data-testid="menu-preferences"]').trigger('click')

    expect(wrapper.emitted('openPreferences')).toHaveLength(1)
  })

  it('emits project file actions from the file menu', async () => {
    const wrapper = mount(MenuBar, {
      props: { mode: 'timing', theme: 'light', audioLoaded: true },
    })

    await wrapper.get('[data-testid="menu-trigger-file"]').trigger('click')
    await wrapper.get('[data-testid="menu-open-project"]').trigger('click')
    expect(wrapper.emitted('openProject')).toHaveLength(1)

    await wrapper.get('[data-testid="menu-trigger-file"]').trigger('click')
    await wrapper.get('[data-testid="menu-save-project"]').trigger('click')
    expect(wrapper.emitted('saveProject')).toHaveLength(1)

    await wrapper.get('[data-testid="menu-trigger-file"]').trigger('click')
    await wrapper.get('[data-testid="menu-save-as"]').trigger('click')
    expect(wrapper.emitted('saveProjectAs')).toHaveLength(1)
  })

  it('emits validateProject from the file menu', async () => {
    const wrapper = mount(MenuBar, {
      props: { mode: 'timing', theme: 'light', audioLoaded: true },
    })

    await wrapper.get('[data-testid="menu-trigger-file"]').trigger('click')
    await wrapper.get('[data-testid="menu-validate-project"]').trigger('click')

    expect(wrapper.emitted('validateProject')).toHaveLength(1)
  })

  it('emits new project and lyric import/export actions from the file menu', async () => {
    const wrapper = mount(MenuBar, {
      props: { mode: 'timing', theme: 'light', audioLoaded: true },
    })

    await wrapper.get('[data-testid="menu-trigger-file"]').trigger('click')
    await wrapper.get('[data-testid="menu-new-project"]').trigger('click')
    expect(wrapper.emitted('newProject')).toHaveLength(1)

    await wrapper.get('[data-testid="menu-trigger-file"]').trigger('click')
    await wrapper.get('[data-testid="menu-import-lyrics"]').trigger('click')
    expect(wrapper.emitted('importLyricsFile')).toHaveLength(1)

    await wrapper.get('[data-testid="menu-trigger-file"]').trigger('click')
    await wrapper.get('[data-testid="menu-export-lyrics"]').trigger('mouseenter')
    await wrapper
      .get('[data-testid="menu-export-lyrics-lrc-enhanced"]')
      .trigger('click')
    expect(wrapper.emitted('exportLyricsFile')?.[0]).toEqual(['lrc-enhanced'])
  })

  it('offers every supported lyric export target from a nested file menu', async () => {
    const wrapper = mount(MenuBar, {
      props: { mode: 'timing', theme: 'light', audioLoaded: true },
    })

    await wrapper.get('[data-testid="menu-trigger-file"]').trigger('click')
    expect(wrapper.find('[data-testid="menu-export-lyrics-txt"]').exists()).toBe(false)
    await wrapper.get('[data-testid="menu-export-lyrics"]').trigger('mouseenter')
    expect(wrapper.find('[data-testid="menu-popup-export-lyrics"]').exists()).toBe(true)

    for (const format of [
      'txt',
      'lrc-line',
      'lrc-enhanced',
      'lrc-eslyric',
      'ttml',
      'ass',
      'srt',
      'vtt',
    ]) {
      expect(
        wrapper.find(`[data-testid="menu-export-lyrics-${format}"]`).exists(),
      ).toBe(true)
    }
  })

  it('closes the export submenu when hovering another file menu item', async () => {
    const wrapper = mount(MenuBar, {
      props: { mode: 'timing', theme: 'light', audioLoaded: true },
    })

    await wrapper.get('[data-testid="menu-trigger-file"]').trigger('click')
    await wrapper.get('[data-testid="menu-export-lyrics"]').trigger('mouseenter')
    expect(wrapper.find('[data-testid="menu-popup-export-lyrics"]').exists()).toBe(true)

    await wrapper.get('[data-testid="menu-open-project"]').trigger('mouseenter')

    expect(wrapper.find('[data-testid="menu-popup-export-lyrics"]').exists()).toBe(
      false,
    )
  })

  it('shows export timing loss warnings', async () => {
    const wrapper = mount(MenuBar, {
      props: { mode: 'timing', theme: 'light', audioLoaded: true },
    })

    await wrapper.get('[data-testid="menu-trigger-file"]').trigger('click')
    await wrapper.get('[data-testid="menu-export-lyrics"]').trigger('mouseenter')

    expect(wrapper.get('[data-testid="menu-export-lyrics-txt"]').text()).toContain(
      '会损失所有时间轴信息',
    )
    expect(wrapper.get('[data-testid="menu-export-lyrics-lrc-line"]').text()).toContain(
      '会损失逐词时间轴信息',
    )
    expect(wrapper.get('[data-testid="menu-export-lyrics-srt"]').text()).toContain(
      '会损失逐词时间轴信息',
    )
    expect(wrapper.get('[data-testid="menu-export-lyrics-vtt"]').text()).toContain(
      '会损失逐词时间轴信息',
    )
    expect(
      wrapper.get('[data-testid="menu-export-lyrics-lrc-enhanced"]').text(),
    ).not.toContain('会损失')
  })

  it('shows dirty project title with leading star', () => {
    const wrapper = mount(MenuBar, {
      props: {
        mode: 'timing',
        theme: 'light',
        audioLoaded: true,
        projectTitle: 'Song A',
        dirty: true,
      },
    })

    expect(wrapper.get('[data-testid="menu-title-button"]').text()).toBe(
      '*Song A - Lyrics Maker',
    )
  })

  it('edits project title inline on enter and cancels with escape', async () => {
    const wrapper = mount(MenuBar, {
      props: {
        mode: 'timing',
        theme: 'light',
        audioLoaded: true,
        projectTitle: 'Song A',
      },
      attachTo: document.body,
    })

    await wrapper.get('[data-testid="menu-title-button"]').trigger('click')
    const input = wrapper.get('[data-testid="menu-title-input"]')
    expect(document.activeElement).toBe(input.element)

    await input.setValue('Song B')
    await input.trigger('keydown.enter')
    expect(wrapper.emitted('updateProjectTitle')?.[0]).toEqual(['Song B'])

    await wrapper.get('[data-testid="menu-title-button"]').trigger('click')
    await wrapper.get('[data-testid="menu-title-input"]').setValue('Discard')
    await wrapper.get('[data-testid="menu-title-input"]').trigger('keydown.escape')

    expect(wrapper.emitted('updateProjectTitle')).toHaveLength(1)
  })

  it('emits undo with translated command label from edit menu', async () => {
    const wrapper = mount(MenuBar, {
      props: {
        mode: 'timing',
        theme: 'light',
        audioLoaded: true,
        canUndo: true,
        nextUndoLabel: 'lyrics.addLine',
      },
    })

    await wrapper.get('[data-testid="menu-trigger-edit"]').trigger('click')
    const undo = wrapper.get('[data-testid="menu-undo"]')

    expect((undo.element as HTMLButtonElement).disabled).toBe(false)
    expect(undo.text()).toContain('添加歌词行')

    await undo.trigger('click')

    expect(wrapper.emitted('undo')).toHaveLength(1)
    expect(wrapper.find('[data-testid="menu-popup-edit"]').exists()).toBe(false)
  })

  it.each([
    ['project.setTitle', '修改工程名'],
    ['lyrics.replaceAll', '替换歌词'],
  ])('translates %s in undo and redo menu labels', async (commandLabel, expected) => {
    const wrapper = mount(MenuBar, {
      props: {
        mode: 'timing',
        theme: 'light',
        audioLoaded: true,
        canUndo: true,
        canRedo: true,
        nextUndoLabel: commandLabel,
        nextRedoLabel: commandLabel,
      },
    })

    await wrapper.get('[data-testid="menu-trigger-edit"]').trigger('click')

    expect(wrapper.get('[data-testid="menu-undo"]').text()).toContain(expected)
    expect(wrapper.get('[data-testid="menu-redo"]').text()).toContain(expected)
  })

  it('lets edit menu grow to fit long undo and redo labels without wrapping', async () => {
    const wrapper = mount(MenuBar, {
      props: {
        mode: 'timing',
        theme: 'light',
        audioLoaded: true,
        canUndo: true,
        canRedo: true,
        nextUndoLabel: 'lyrics.clearWordEndTime',
        nextRedoLabel: 'lyrics.replaceLineWords',
      },
    })

    await wrapper.get('[data-testid="menu-trigger-edit"]').trigger('click')

    expect(wrapper.get('[data-testid="menu-popup-edit"]').classes()).toContain('w-max')
    expect(wrapper.get('[data-testid="menu-undo"]').classes()).toContain(
      'whitespace-nowrap',
    )
    expect(wrapper.get('[data-testid="menu-redo"]').classes()).toContain(
      'whitespace-nowrap',
    )
  })

  it('emits redo with translated command label from edit menu', async () => {
    const wrapper = mount(MenuBar, {
      props: {
        mode: 'timing',
        theme: 'light',
        audioLoaded: true,
        canRedo: true,
        nextRedoLabel: 'settings.setSnapDivisor',
      },
    })

    await wrapper.get('[data-testid="menu-trigger-edit"]').trigger('click')
    const redo = wrapper.get('[data-testid="menu-redo"]')

    expect((redo.element as HTMLButtonElement).disabled).toBe(false)
    expect(redo.text()).toContain('调整细分倍数')

    await redo.trigger('click')

    expect(wrapper.emitted('redo')).toHaveLength(1)
  })

  it('disables undo and redo when no operations are available', async () => {
    const wrapper = mount(MenuBar, {
      props: { mode: 'timing', theme: 'light', audioLoaded: true },
    })

    await wrapper.get('[data-testid="menu-trigger-edit"]').trigger('click')

    expect(
      (wrapper.get('[data-testid="menu-undo"]').element as HTMLButtonElement).disabled,
    ).toBe(true)
    expect(
      (wrapper.get('[data-testid="menu-redo"]').element as HTMLButtonElement).disabled,
    ).toBe(true)
  })

  it('renders help menu with about item only for now', async () => {
    const wrapper = mount(MenuBar, {
      props: { mode: 'timing', theme: 'light', audioLoaded: true },
    })

    await wrapper.get('[data-testid="menu-trigger-help"]').trigger('click')

    expect(wrapper.get('[data-testid="menu-about"]').text()).toContain('关于')
    expect(wrapper.find('[data-testid="menu-shortcuts"]').exists()).toBe(false)
  })

  it('emits openAbout from the help menu', async () => {
    const wrapper = mount(MenuBar, {
      props: { mode: 'timing', theme: 'light', audioLoaded: true },
    })

    await wrapper.get('[data-testid="menu-trigger-help"]').trigger('click')
    const aboutButton = wrapper.get('[data-testid="menu-about"]')
    expect(aboutButton.attributes('disabled')).toBeUndefined()
    await aboutButton.trigger('click')

    expect(wrapper.emitted('openAbout')).toHaveLength(1)
  })

  it('does not render the old top-level lyrics menu', () => {
    const wrapper = mount(MenuBar, {
      props: { mode: 'timing', theme: 'light', audioLoaded: true },
    })
    expect(wrapper.find('[data-testid="menu-trigger-lyrics"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="menu-popup-lyrics"]').exists()).toBe(false)
  })
})
