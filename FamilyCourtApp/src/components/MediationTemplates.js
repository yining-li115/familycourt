import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import colors from '../theme/colors';

// ─── Template definitions ─────────────────────────────────────────────────────
// Placeholders wrapped in 【】 will be highlighted in warm brown.

const TEMPLATES = [
  {
    id: 'A',
    title: '家务分工类',
    icon: '🏠',
    description: '适用于家务劳动分配不均引发的矛盾',
    content:
      '经家庭法院调解，双方就家务分工达成以下协议：\n\n' +
      '一、【原告方】负责承担以下家务：【具体家务项目，如：做饭、洗碗、打扫客厅】，频率为【每天/每周X次】。\n\n' +
      '二、【被告方】负责承担以下家务：【具体家务项目，如：拖地、洗衣、倒垃圾】，频率为【每天/每周X次】。\n\n' +
      '三、若一方因特殊原因无法按时完成，应提前【X小时/天】告知对方，双方可协商临时调整。\n\n' +
      '四、本协议自【签署日期】起执行，双方共同遵守，以营造和谐家庭氛围。\n\n' +
      '如在履行过程中出现分歧，双方应友好协商，必要时可再次提请家庭法院调解。',
  },
  {
    id: 'B',
    title: '消费决策类',
    icon: '💰',
    description: '适用于家庭财务、消费决策产生的分歧',
    content:
      '经家庭法院调解，双方就消费决策达成以下协议：\n\n' +
      '一、关于此次争议的【消费项目/金额】，双方同意：【具体处理方式，如：暂缓购买/按XX方式处理/各自承担XX比例费用】。\n\n' +
      '二、今后家庭日常消费（单笔金额在【X元】以内）无需事先商议，由购买方自行决定。\n\n' +
      '三、超过【X元】的非紧急性支出，需提前【X天】告知对方，双方协商一致后方可执行。\n\n' +
      '四、每月【X日】双方坐下来共同回顾当月家庭收支，建立透明的家庭财务沟通机制。\n\n' +
      '本协议旨在减少消费摩擦，建立基于信任的家庭财务决策模式。',
  },
  {
    id: 'C',
    title: '言语冲突类',
    icon: '💬',
    description: '适用于因言语伤害、沟通方式引发的矛盾',
    content:
      '经家庭法院调解，双方就此次言语冲突达成以下和解协议：\n\n' +
      '一、双方均认可，本次冲突中使用了不当言辞，包括但不限于【具体言语，如：指责性语言/贬低性话语】，造成了对方的情绪伤害。\n\n' +
      '二、【原告/被告/双方】在此向对方真诚道歉，表示遗憾与歉意。\n\n' +
      '三、双方承诺，今后在家庭沟通中：\n' +
      '   · 不使用侮辱性、贬低性语言；\n' +
      '   · 情绪激动时，可申请暂停对话，给彼此冷静空间（冷静时间不超过【X小时】）；\n' +
      '   · 复盘对话时，以"我的感受"代替"你的错误"表达方式。\n\n' +
      '四、如未来再次出现类似冲突，任何一方可随时提请家庭法院调解。\n\n' +
      '愿双方以此为契机，建立更加平和、有效的沟通方式。',
  },
  {
    id: 'D',
    title: '教育分歧类',
    icon: '📚',
    description: '适用于子女教育理念、方式不一致的矛盾',
    content:
      '经家庭法院调解，双方就子女【孩子姓名/称呼】的教育问题达成以下协议：\n\n' +
      '一、关于此次争议的核心问题【具体教育问题，如：补习班报名/游戏时间限制/成绩要求】，双方同意：【具体处理方案】。\n\n' +
      '二、日常学习安排：\n' +
      '   · 平日作业及日常学习由【一方】主要陪伴，遇到分歧先由陪伴方决定；\n' +
      '   · 重大教育决策（如：择校、兴趣班选择、是否参加重要考试等）需双方共同商量。\n\n' +
      '三、双方均认同，孩子的身心健康与学业同等重要，承诺不以学习成绩作为评价孩子价值的唯一标准。\n\n' +
      '四、每【X周/月】双方共同复盘孩子的学习和生活状况，及时调整教育策略。\n\n' +
      '愿双方携手，为孩子创造一个充满爱与支持的成长环境。',
  },
  {
    id: 'E',
    title: '通用补偿型',
    icon: '🤝',
    description: '适用于需要一方给予具体补偿的各类矛盾',
    content:
      '经家庭法院调解，双方就本次纠纷达成以下补偿协议：\n\n' +
      '一、事件回顾：【简要描述事件经过，一两句话即可】。\n\n' +
      '二、责任认定：经调解，【责任方】对本次事件承担主要责任，愿意给予对方适当补偿。\n\n' +
      '三、补偿方案（以下选择一项或多项）：\n' +
      '   □ 道歉：【责任方】向【受损方】正式道歉，表达诚意；\n' +
      '   □ 行为补偿：【责任方】承诺【具体行为补偿，如：连续一周承担全部家务/陪对方做一件喜欢的事】；\n' +
      '   □ 物质补偿：由【责任方】承担【具体补偿内容，如：请对方吃一顿饭/购买XX礼物】；\n' +
      '   □ 其他约定：【双方自定义的补偿方式】。\n\n' +
      '四、补偿完成时间：【X日内/X月X日前】。\n\n' +
      '五、本协议签署后，双方同意翻篇此事，不再以此事相互指责。\n\n' +
      '本次调解以促进家庭和解为目的，希望双方从中获得相互理解。',
  },
];

// ─── Placeholder highlight renderer ─────────────────────────────────────────
// Splits text on 【...】 and renders placeholders in warm brown.
function HighlightedText({ text, style }) {
  const parts = text.split(/(【[^】]*】)/g);
  return (
    <Text style={style}>
      {parts.map((part, i) => {
        const isPlaceholder = /^【.*】$/.test(part);
        return (
          <Text key={i} style={isPlaceholder ? styles.placeholder : undefined}>
            {part}
          </Text>
        );
      })}
    </Text>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function MediationTemplates({ visible, onClose, onSelect }) {
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [editedContent, setEditedContent] = useState('');

  function handleSelectTemplate(tmpl) {
    setSelectedTemplate(tmpl);
    setEditedContent(tmpl.content);
  }

  function handleBack() {
    setSelectedTemplate(null);
    setEditedContent('');
  }

  function handleUse() {
    onSelect(editedContent);
    // Reset state for next open
    setSelectedTemplate(null);
    setEditedContent('');
  }

  function handleClose() {
    setSelectedTemplate(null);
    setEditedContent('');
    onClose();
  }

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container}>
        {/* ── Template list ── */}
        {!selectedTemplate && (
          <>
            <View style={styles.header}>
              <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
              <Text style={styles.headerTitle}>选择调解方案模板</Text>
              <View style={{ width: 36 }} />
            </View>
            <Text style={styles.headerSub}>选择最符合当前纠纷类型的模板，填写后即可使用</Text>
            <ScrollView contentContainerStyle={styles.listContent}>
              {TEMPLATES.map((tmpl) => (
                <TouchableOpacity
                  key={tmpl.id}
                  style={styles.templateCard}
                  onPress={() => handleSelectTemplate(tmpl)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.templateIcon}>{tmpl.icon}</Text>
                  <View style={styles.templateInfo}>
                    <Text style={styles.templateTitle}>
                      模板 {tmpl.id}：{tmpl.title}
                    </Text>
                    <Text style={styles.templateDesc}>{tmpl.description}</Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        {/* ── Template editor ── */}
        {selectedTemplate && (
          <>
            <View style={styles.header}>
              <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
                <Text style={styles.backBtnText}>← 返回选模板</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.editorHeader}>
              <Text style={styles.templateIcon}>{selectedTemplate.icon}</Text>
              <Text style={styles.editorTitle}>
                模板 {selectedTemplate.id}：{selectedTemplate.title}
              </Text>
            </View>

            <View style={styles.hintBox}>
              <Text style={styles.hintText}>
                将 <Text style={styles.placeholder}>【方括号内】</Text> 的占位符替换为实际内容，删除不适用的选项。
              </Text>
            </View>

            <ScrollView style={styles.editorScroll} contentContainerStyle={{ paddingBottom: 100 }}>
              <TextInput
                style={styles.editorInput}
                value={editedContent}
                onChangeText={setEditedContent}
                multiline
                textAlignVertical="top"
              />

              {/* Live preview with highlights */}
              <View style={styles.previewBox}>
                <Text style={styles.previewLabel}>预览（高亮显示未填写的占位符）</Text>
                <HighlightedText text={editedContent} style={styles.previewText} />
              </View>
            </ScrollView>

            <View style={styles.editorFooter}>
              <TouchableOpacity style={styles.useBtn} onPress={handleUse}>
                <Text style={styles.useBtnText}>使用此方案</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.warmLight,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.stoneLight,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.black,
  },
  headerSub: {
    fontSize: 13,
    color: colors.stone,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  closeBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 16,
    color: colors.stone,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  templateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  templateIcon: {
    fontSize: 28,
    marginRight: 14,
  },
  templateInfo: {
    flex: 1,
  },
  templateTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.black,
    marginBottom: 4,
  },
  templateDesc: {
    fontSize: 13,
    color: colors.stone,
    lineHeight: 20,
  },
  chevron: {
    fontSize: 22,
    color: colors.primaryMid,
    marginLeft: 8,
  },
  backBtn: {
    paddingVertical: 4,
  },
  backBtnText: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: '500',
  },
  editorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 4,
  },
  editorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.black,
  },
  hintBox: {
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 6,
    backgroundColor: colors.warmLight,
    borderRadius: 10,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: colors.warm,
  },
  hintText: {
    fontSize: 13,
    color: colors.stone,
    lineHeight: 20,
  },
  placeholder: {
    color: colors.warm,
    fontWeight: '600',
  },
  editorScroll: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  editorInput: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    color: colors.black,
    lineHeight: 24,
    minHeight: 220,
    borderWidth: 1,
    borderColor: colors.primaryMid,
    marginBottom: 16,
    textAlignVertical: 'top',
  },
  previewBox: {
    backgroundColor: colors.stoneLight,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  previewLabel: {
    fontSize: 11,
    color: colors.stone,
    marginBottom: 8,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  previewText: {
    fontSize: 14,
    color: colors.black,
    lineHeight: 22,
  },
  editorFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.stoneLight,
  },
  useBtn: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  useBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
});
