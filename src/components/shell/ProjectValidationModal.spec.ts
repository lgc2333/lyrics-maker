import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import type { ProjectValidationIssue } from '../../core/domain/project-validation'
import ProjectValidationModal from './ProjectValidationModal.vue'

const issues: ProjectValidationIssue[] = [
  {
    severity: 'error',
    code: 'lineIntervalOverlap',
    path: 'lyrics[1].startTime',
    messageKey: 'project.validation.issues.lineIntervalOverlap',
    params: { line: 2 },
  },
  {
    severity: 'warning',
    code: 'emptyTitle',
    path: 'title',
    messageKey: 'project.validation.issues.emptyTitle',
  },
]

describe('projectValidationModal', () => {
  it('renders grouped validation issues and summary counts', () => {
    const wrapper = mount(ProjectValidationModal, {
      props: {
        mode: 'export',
        issues,
      },
    })

    expect(wrapper.get('[data-testid="project-validation-summary"]').text()).toContain(
      '1 个错误',
    )
    expect(wrapper.get('[data-testid="project-validation-summary"]').text()).toContain(
      '1 个警告',
    )
    expect(wrapper.text()).toContain('歌词行时间区间重叠')
    expect(wrapper.text()).toContain('工程标题为空')
    expect(wrapper.text()).toContain('lyrics[1].startTime')
  })

  it('emits continue and cancel in export mode', async () => {
    const wrapper = mount(ProjectValidationModal, {
      props: {
        mode: 'export',
        issues,
      },
    })

    await wrapper.get('[data-testid="project-validation-continue"]').trigger('click')
    await wrapper.get('[data-testid="project-validation-cancel"]').trigger('click')

    expect(wrapper.emitted('continue')).toHaveLength(1)
    expect(wrapper.emitted('cancel')).toHaveLength(1)
    expect(wrapper.find('[data-testid="project-validation-close"]').exists()).toBe(
      false,
    )
  })

  it('emits close in read-only mode', async () => {
    const wrapper = mount(ProjectValidationModal, {
      props: {
        mode: 'readonly',
        issues,
      },
    })

    await wrapper.get('[data-testid="project-validation-close"]').trigger('click')

    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(wrapper.find('[data-testid="project-validation-continue"]').exists()).toBe(
      false,
    )
  })
})
