import { Segmented, Space, Tag, Typography, message } from 'antd'
import { useEffect, useState } from 'react'
import { subjectOptions, type SubjectCode } from '@/constants/subjects'
import { getCurrentSubject, setCurrentSubject, subscribeCurrentSubject } from '@/services/subjects'

interface SubjectSwitchProps {
  compact?: boolean
}

export function SubjectSwitch({ compact = false }: SubjectSwitchProps) {
  const [subject, setSubject] = useState(getCurrentSubject())

  useEffect(() => subscribeCurrentSubject(setSubject), [])

  return (
    <Space direction={compact ? 'horizontal' : 'vertical'} size={compact ? 8 : 12}>
      <Segmented
        value={subject.code}
        options={subjectOptions.map((item) => ({ label: item.name, value: item.code }))}
        onChange={(value) => {
          const nextSubject = setCurrentSubject(value as SubjectCode)
          setSubject(nextSubject)
          message.success(`已切换到${nextSubject.name}`)
        }}
      />
      {compact ? (
        <Tag color={subject.code === 'nursing' ? 'green' : 'blue'}>{subject.name}</Tag>
      ) : (
        <Typography.Text type="secondary">{subject.description}</Typography.Text>
      )}
    </Space>
  )
}
