import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, TextInput,
} from 'react-native';
import colors from '../../theme/colors';
import { casesApi, familiesApi } from '../../services/api';
import { getStatusLabel, getStatusColor, CATEGORY_LABELS, CLAIM_CATEGORY_LABELS } from '../../utils/caseStatus';
import { useAuth } from '../../store/authStore';
import EmotionSlider from '../../components/EmotionSlider';
import VoiceInputModal from '../../components/VoiceInputModal';
import MediationTemplates from '../../components/MediationTemplates';

export default function CaseDetailScreen({ route, navigation }) {
  const { user } = useAuth();
  const { caseId, isNew } = route.params || {};

  const [caseData, setCaseData] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(!isNew);

  // New case form state
  const [newCase, setNewCase] = useState({
    defendant_ids: [],
    plaintiff_ids: [],
    judge_id: '',
    category: 'other',
    plaintiff_statement: '',
    plaintiff_emotion: null,
  });

  // Voice modal for the new-case form
  const [voiceModalVisible, setVoiceModalVisible] = useState(false);

  useEffect(() => {
    if (caseId) {
      loadCase();
    }
    // Load members for both new case form and detail view (to show names)
    familiesApi.members().then(setMembers).catch(console.error);
  }, [caseId, isNew]);

  function memberName(userId) {
    const m = members.find(mm => mm.id === userId);
    return m ? (m.family_alias || m.nickname) : '未知';
  }

  async function loadCase() {
    try {
      const data = await casesApi.get(caseId);
      setCaseData(data);
    } catch (err) {
      Alert.alert('错误', err.message);
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }

  async function handleFileSuit() {
    if (newCase.defendant_ids.length === 0) { Alert.alert('提示', '请选择至少一名被告'); return; }
    if (!newCase.plaintiff_statement.trim()) { Alert.alert('提示', '请填写事实陈述'); return; }
    try {
      await casesApi.create({
        defendant_ids: newCase.defendant_ids,
        plaintiff_ids: newCase.plaintiff_ids.length > 0 ? newCase.plaintiff_ids : undefined,
        judge_id: newCase.judge_id || null,
        category: newCase.category,
        plaintiff_statement: newCase.plaintiff_statement,
        plaintiff_emotion: newCase.plaintiff_emotion != null ? Number(newCase.plaintiff_emotion) : undefined,
      });
      Alert.alert('立案成功', '案件已提交', [{ text: '确定', onPress: () => navigation.goBack() }]);
    } catch (err) {
      Alert.alert('立案失败', err.message);
    }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;

  // ─── New case form ──────────────────────────────────────────────────────────

  if (isNew) {
    const others = members.filter((m) => m.id !== user.id);
    const statementCharCount = newCase.plaintiff_statement.length;
    const statementNearLimit = statementCharCount >= 400;

    return (
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 48 }}>
        <Text style={styles.formTitle}>新起诉</Text>

        <Text style={styles.label}>被告 *（可多选）</Text>
        <View style={styles.multiSelectRow}>
          {others.map((m) => {
            const selected = newCase.defendant_ids.includes(m.id);
            return (
              <TouchableOpacity
                key={m.id}
                style={[styles.memberChip, selected && styles.memberChipSelected]}
                onPress={() => setNewCase((p) => {
                  const ids = selected
                    ? p.defendant_ids.filter(id => id !== m.id)
                    : [...p.defendant_ids, m.id];
                  // Remove from plaintiff_ids and judge if added as defendant
                  return {
                    ...p,
                    defendant_ids: ids,
                    plaintiff_ids: p.plaintiff_ids.filter(id => !ids.includes(id)),
                    judge_id: ids.includes(p.judge_id) ? '' : p.judge_id,
                  };
                })}
              >
                <Text style={[styles.memberChipText, selected && { color: colors.primary }]}>
                  {selected ? '✓ ' : ''}{m.family_alias || m.nickname}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.label}>共同原告（选填，可多选）</Text>
        <View style={styles.multiSelectRow}>
          {others.filter(m => !newCase.defendant_ids.includes(m.id)).map((m) => {
            const selected = newCase.plaintiff_ids.includes(m.id);
            return (
              <TouchableOpacity
                key={m.id}
                style={[styles.memberChip, selected && styles.memberChipSelected]}
                onPress={() => setNewCase((p) => {
                  const ids = selected
                    ? p.plaintiff_ids.filter(id => id !== m.id)
                    : [...p.plaintiff_ids, m.id];
                  return { ...p, plaintiff_ids: ids, judge_id: ids.includes(p.judge_id) ? '' : p.judge_id };
                })}
              >
                <Text style={[styles.memberChipText, selected && { color: colors.primary }]}>
                  {selected ? '✓ ' : ''}{m.family_alias || m.nickname}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.label}>法官（选填，不选则由 AI 担任）</Text>
        {others.filter((m) => !newCase.defendant_ids.includes(m.id) && !newCase.plaintiff_ids.includes(m.id)).map((m) => (
          <TouchableOpacity
            key={m.id}
            style={[styles.memberBtn, newCase.judge_id === m.id && styles.memberBtnSelected]}
            onPress={() => setNewCase((p) => ({ ...p, judge_id: p.judge_id === m.id ? '' : m.id }))}
          >
            <Text style={[styles.memberBtnText, newCase.judge_id === m.id && { color: colors.primary }]}>
              {m.family_alias || m.nickname}
            </Text>
          </TouchableOpacity>
        ))}

        <Text style={styles.label}>案由 *</Text>
        <View style={styles.categoryRow}>
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <TouchableOpacity
              key={key}
              style={[styles.categoryBtn, newCase.category === key && styles.categoryBtnSelected]}
              onPress={() => setNewCase((p) => ({ ...p, category: key }))}
            >
              <Text style={[styles.categoryBtnText, newCase.category === key && { color: colors.primary }]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Statement field with microphone button ── */}
        <Text style={styles.label}>
          事实陈述 * （≤ 500 字）
          {statementNearLimit && (
            <Text style={styles.charWarnInline}> ⚠️ 剩余 {500 - statementCharCount} 字</Text>
          )}
        </Text>
        <View style={styles.textareaWrapper}>
          <TextInput
            style={styles.textarea}
            value={newCase.plaintiff_statement}
            onChangeText={(t) => setNewCase((p) => ({ ...p, plaintiff_statement: t.slice(0, 500) }))}
            placeholder="请描述发生了什么……"
            placeholderTextColor={colors.stone}
            multiline
            maxLength={500}
            textAlignVertical="top"
          />
          {/* Microphone button — bottom-right corner of the text area */}
          <TouchableOpacity
            style={styles.micBtn}
            onPress={() => setVoiceModalVisible(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.micIcon}>🎙️</Text>
          </TouchableOpacity>
        </View>

        {/* ── Emotion slider (replaces plain TextInput) ── */}
        <Text style={styles.label}>情绪温度（选填）</Text>
        <EmotionSlider
          value={newCase.plaintiff_emotion}
          onChange={(v) => setNewCase((p) => ({ ...p, plaintiff_emotion: v }))}
        />

        <TouchableOpacity style={styles.submitBtn} onPress={handleFileSuit}>
          <Text style={styles.submitBtnText}>提交立案</Text>
        </TouchableOpacity>

        {/* Voice input modal */}
        <VoiceInputModal
          visible={voiceModalVisible}
          onClose={() => setVoiceModalVisible(false)}
          onConfirm={(text) => {
            setNewCase((p) => ({ ...p, plaintiff_statement: text.slice(0, 500) }));
            setVoiceModalVisible(false);
          }}
          initialText={newCase.plaintiff_statement}
        />
      </ScrollView>
    );
  }

  // ─── Case detail view ───────────────────────────────────────────────────────

  if (!caseData) return null;

  const isPlaintiff = caseData.plaintiff_id === user.id ||
    (caseData.plaintiff_ids && caseData.plaintiff_ids.includes(user.id));
  const isDefendant = caseData.defendant_id === user.id ||
    (caseData.defendant_ids && caseData.defendant_ids.includes(user.id));
  const role = isPlaintiff ? 'plaintiff'
    : isDefendant ? 'defendant'
    : caseData.judge_id === user.id ? 'judge' : 'bystander';

  const statusColor = getStatusColor(caseData.status);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 48 }}>
      <View style={styles.caseHeader}>
        <Text style={styles.caseNumber}>{caseData.case_number}</Text>
        <View style={[styles.badge, { backgroundColor: statusColor + '20', borderColor: statusColor }]}>
          <Text style={[styles.badgeText, { color: statusColor }]}>{getStatusLabel(caseData.status)}</Text>
        </View>
      </View>

      <Text style={styles.category}>{CATEGORY_LABELS[caseData.category] || caseData.category}</Text>
      {caseData.is_ai_judge && (
        <View style={styles.aiTag}><Text style={styles.aiTagText}>🤖 AI 法官主持</Text></View>
      )}

      {caseData.plaintiff_statement && (
        <Section title="原告陈述">
          <Text style={styles.body}>{caseData.plaintiff_statement}</Text>
          {caseData.plaintiff_emotion && (
            <Text style={styles.emotion}>情绪温度：{caseData.plaintiff_emotion}/10</Text>
          )}
        </Section>
      )}

      {/* Show each defendant's statement from case_parties */}
      {caseData.parties && caseData.parties.filter(p => p.role === 'defendant' && p.statement).length > 0 ? (
        caseData.parties.filter(p => p.role === 'defendant' && p.statement).map((p, idx) => (
          <Section key={p.id} title={`被告答辩${caseData.parties.filter(pp => pp.role === 'defendant').length > 1 ? ` (${idx + 1})` : ''}`}>
            {members.length > 0 && (
              <Text style={styles.partyName}>{memberName(p.user_id)}</Text>
            )}
            <Text style={styles.body}>{p.statement}</Text>
            {p.emotion && <Text style={styles.emotion}>情绪温度：{p.emotion}/10</Text>}
          </Section>
        ))
      ) : caseData.defendant_statement ? (
        <Section title="被告答辩">
          <Text style={styles.body}>{caseData.defendant_statement}</Text>
          {caseData.defendant_emotion && (
            <Text style={styles.emotion}>情绪温度：{caseData.defendant_emotion}/10</Text>
          )}
        </Section>
      ) : null}

      {/* Show inquiries */}
      {caseData.inquiries && caseData.inquiries.length > 0 && (
        <Section title="问询记录">
          {caseData.inquiries.map((inq, idx) => (
            <View key={inq.id} style={[styles.inquiryItem, idx > 0 && { borderTopWidth: 1, borderTopColor: colors.stoneLight, paddingTop: 12, marginTop: 12 }]}>
              <Text style={styles.inquiryLabel}>
                {inq.type === 'confrontation' ? '🔥 对质' : `问询 #${idx + 1}`} → {inq.target === 'plaintiff' ? '原告' : '被告'}
              </Text>
              <Text style={styles.inquiryQuestion}>Q: {inq.question}</Text>
              {inq.answer ? (
                <Text style={styles.inquiryAnswer}>A: {inq.answer}</Text>
              ) : (
                <Text style={styles.inquiryPending}>待回答</Text>
              )}
            </View>
          ))}
        </Section>
      )}

      {caseData.fact_finding && (
        <Section title={`事实认定${caseData.fact_finding_is_ai ? '  🤖 AI 生成' : ''}`}>
          <Text style={styles.body}>{caseData.fact_finding}</Text>
        </Section>
      )}

      {caseData.plaintiff_claim && (
        <Section title="原告诉求">
          <Text style={styles.tagPill}>{CLAIM_CATEGORY_LABELS[caseData.claim_category]}</Text>
          <Text style={styles.body}>{caseData.plaintiff_claim}</Text>
        </Section>
      )}

      {caseData.mediation_plan && (
        <Section title={`调解方案${caseData.mediation_plan_is_ai ? '  🤖 AI 生成' : ''}`}>
          <Text style={styles.body}>{caseData.mediation_plan}</Text>
        </Section>
      )}

      {caseData.verdict && (
        <Section title="结案内容">
          <Text style={styles.body}>{caseData.verdict}</Text>
        </Section>
      )}

      {/* Action area depending on role + status */}
      <ActionArea case_={caseData} role={role} userId={user.id} onRefresh={loadCase} navigation={navigation} />
    </ScrollView>
  );
}

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function ActionArea({ case_, role, userId, onRefresh, navigation }) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  // Mediation template state (judge + mediation stage)
  const [mediationInput, setMediationInput] = useState('');
  const [templateModalVisible, setTemplateModalVisible] = useState(false);

  async function act(fn) {
    setLoading(true);
    try {
      await fn();
      await onRefresh();
    } catch (err) {
      Alert.alert('操作失败', err.message);
    } finally {
      setLoading(false);
    }
  }

  if (case_.status === 'pending_judge_accept' && role === 'judge') {
    return (
      <View style={styles.actionArea}>
        <Text style={styles.actionTitle}>受理案件</Text>
        <Text style={styles.actionHint}>请选择被告答辩截止时间</Text>
        {[24, 48, 72].map((h) => (
          <TouchableOpacity key={h} style={styles.actionBtn} onPress={() => act(() => casesApi.accept(case_.id, h))}>
            <Text style={styles.actionBtnText}>{h} 小时内</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={[styles.actionBtn, styles.recuseBtn]} onPress={() => act(() => casesApi.recuse(case_.id))}>
          <Text style={[styles.actionBtnText, { color: colors.warm }]}>申请回避</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (case_.status === 'pending_defendant' && role === 'defendant') {
    return (
      <View style={styles.actionArea}>
        <Text style={styles.actionTitle}>提交答辩</Text>
        <TextInput style={styles.textarea} value={input} onChangeText={setInput} placeholder="请陈述你的看法……" multiline textAlignVertical="top" placeholderTextColor={colors.stone} />
        <TouchableOpacity style={styles.actionBtn} disabled={loading} onPress={() => act(() => casesApi.defend(case_.id, { defendant_statement: input }))}>
          <Text style={styles.actionBtnText}>提交答辩</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Judge: inquiry phase ─────────────────────────────────────────────────
  if (case_.status === 'pending_inquiry' && role === 'judge') {
    return (
      <JudgeInquiryArea case_={case_} loading={loading} act={act} />
    );
  }

  // ── Judge: fact finding (can also be triggered from inquiry phase) ──────
  if (['pending_inquiry', 'pending_fact_finding'].includes(case_.status) && role === 'judge' && !case_.fact_finding) {
    // This is shown as a secondary action when inquiries are done
  }

  if (case_.status === 'pending_claim' && role === 'plaintiff') {
    return (
      <View style={styles.actionArea}>
        <Text style={styles.actionTitle}>提出诉求</Text>
        <TextInput style={styles.textarea} value={input} onChangeText={setInput} placeholder="你希望对方怎么做……" multiline textAlignVertical="top" placeholderTextColor={colors.stone} />
        <TouchableOpacity style={styles.actionBtn} disabled={loading} onPress={() => act(() => casesApi.submitClaim(case_.id, { plaintiff_claim: input, claim_category: 'other' }))}>
          <Text style={styles.actionBtnText}>提交诉求</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (case_.status === 'pending_defendant_response' && role === 'defendant') {
    return (
      <View style={styles.actionArea}>
        <Text style={styles.actionTitle}>对诉求表态</Text>
        {['accept', 'partial', 'reject'].map((r) => (
          <TouchableOpacity key={r} style={styles.actionBtn} disabled={loading} onPress={() => act(() => casesApi.respond(case_.id, r, ''))}>
            <Text style={styles.actionBtnText}>{{ accept: '✅ 完全接受', partial: '🔶 部分接受', reject: '❌ 不接受' }[r]}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  // ── Judge submits mediation plan ──────────────────────────────────────────
  if (case_.status === 'mediation' && !case_.mediation_plan && role === 'judge') {
    return (
      <View style={styles.actionArea}>
        <Text style={styles.actionTitle}>提交调解方案</Text>
        <Text style={styles.actionHint}>请起草调解方案，也可使用模板快速填写</Text>

        {/* Template selector button */}
        <TouchableOpacity
          style={styles.templateBtn}
          onPress={() => setTemplateModalVisible(true)}
        >
          <Text style={styles.templateBtnText}>📋 使用模板</Text>
        </TouchableOpacity>

        <TextInput
          style={styles.textarea}
          value={mediationInput}
          onChangeText={setMediationInput}
          placeholder="请输入调解方案……"
          multiline
          textAlignVertical="top"
          placeholderTextColor={colors.stone}
        />

        <TouchableOpacity
          style={[styles.actionBtn, !mediationInput.trim() && styles.actionBtnDisabled]}
          disabled={loading || !mediationInput.trim()}
          onPress={() => act(() => casesApi.mediate(case_.id, mediationInput))}
        >
          <Text style={styles.actionBtnText}>提交调解方案</Text>
        </TouchableOpacity>

        <MediationTemplates
          visible={templateModalVisible}
          onClose={() => setTemplateModalVisible(false)}
          onSelect={(text) => {
            setMediationInput(text);
            setTemplateModalVisible(false);
          }}
        />
      </View>
    );
  }

  if (case_.status === 'mediation' && case_.mediation_plan && (role === 'plaintiff' || role === 'defendant')) {
    const myResp = role === 'plaintiff' ? case_.plaintiff_mediation_response : case_.defendant_mediation_response;
    if (!myResp) {
      return (
        <View style={styles.actionArea}>
          <Text style={styles.actionTitle}>对调解方案表态</Text>
          {['accept', 'reject'].map((r) => (
            <TouchableOpacity key={r} style={styles.actionBtn} disabled={loading} onPress={() => act(() => casesApi.mediationResponse(case_.id, r))}>
              <Text style={styles.actionBtnText}>{{ accept: '✅ 接受', reject: '❌ 不接受' }[r]}</Text>
            </TouchableOpacity>
          ))}
        </View>
      );
    }
  }

  return null;
}

// ─── Judge Inquiry + Fact Finding Area ────────────────────────────────────────

function JudgeInquiryArea({ case_, loading: parentLoading, act }) {
  const [question, setQuestion] = useState('');
  const [target, setTarget] = useState('plaintiff');
  const [type, setType] = useState('private_plaintiff');
  const [loading, setLoading] = useState(false);
  const [factFinding, setFactFinding] = useState('');
  const [showFactFinding, setShowFactFinding] = useState(false);

  const allAnswered = case_.inquiries
    ? case_.inquiries.length > 0 && case_.inquiries.every(i => i.answer)
    : false;

  async function handleSendInquiry() {
    if (!question.trim()) { Alert.alert('提示', '请输入问题'); return; }
    setLoading(true);
    try {
      await casesApi.addInquiry(case_.id, {
        type,
        question: question.trim(),
        target,
      });
      setQuestion('');
      await act(async () => {}); // refresh
    } catch (err) {
      Alert.alert('发送失败', err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitFactFinding() {
    if (!factFinding.trim()) { Alert.alert('提示', '请输入事实认定'); return; }
    await act(() => casesApi.submitFactFinding(case_.id, factFinding.trim()));
  }

  if (showFactFinding || (allAnswered && !case_.fact_finding)) {
    return (
      <View style={styles.actionArea}>
        <Text style={styles.actionTitle}>事实认定</Text>
        <Text style={styles.actionHint}>根据双方陈述和问询记录，撰写中立的事实认定</Text>
        <TextInput
          style={styles.textarea}
          value={factFinding}
          onChangeText={setFactFinding}
          placeholder="请输入事实认定……"
          multiline
          textAlignVertical="top"
          placeholderTextColor={colors.stone}
        />
        <TouchableOpacity
          style={[styles.actionBtn, !factFinding.trim() && styles.actionBtnDisabled]}
          disabled={loading || !factFinding.trim()}
          onPress={handleSubmitFactFinding}
        >
          <Text style={styles.actionBtnText}>提交事实认定</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.actionArea}>
      <Text style={styles.actionTitle}>法官问询</Text>
      <Text style={styles.actionHint}>向当事人提问以厘清事实（最多3轮）</Text>

      {/* Target selection */}
      <View style={styles.inquiryTargetRow}>
        {[
          { key: 'plaintiff', label: '问原告', t: 'private_plaintiff' },
          { key: 'defendant', label: '问被告', t: 'private_defendant' },
          { key: 'both', label: '对质', t: 'confrontation' },
        ].map(opt => (
          <TouchableOpacity
            key={opt.key}
            style={[styles.inquiryTargetBtn, type === opt.t && styles.inquiryTargetBtnActive]}
            onPress={() => { setTarget(opt.key === 'both' ? 'plaintiff' : opt.key); setType(opt.t); }}
          >
            <Text style={[styles.inquiryTargetText, type === opt.t && { color: colors.primary }]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TextInput
        style={styles.textarea}
        value={question}
        onChangeText={setQuestion}
        placeholder="请输入问题……"
        multiline
        textAlignVertical="top"
        placeholderTextColor={colors.stone}
      />

      <TouchableOpacity
        style={[styles.actionBtn, (!question.trim() || loading) && styles.actionBtnDisabled]}
        disabled={loading || !question.trim()}
        onPress={handleSendInquiry}
      >
        <Text style={styles.actionBtnText}>{loading ? '发送中…' : '发送问询'}</Text>
      </TouchableOpacity>

      {/* Option to skip inquiry and go to fact finding */}
      <TouchableOpacity
        style={[styles.actionBtn, { backgroundColor: colors.warmLight, marginTop: 4 }]}
        onPress={() => setShowFactFinding(true)}
      >
        <Text style={[styles.actionBtnText, { color: colors.warm }]}>
          {case_.inquiries && case_.inquiries.length > 0 ? '结束问询，进入事实认定' : '跳过问询，直接事实认定'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.warmLight, paddingHorizontal: 20, paddingTop: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  caseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  caseNumber: { fontSize: 13, color: colors.stone, fontFamily: 'monospace' },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  badgeText: { fontSize: 12, fontWeight: '500' },
  category: { fontSize: 22, fontWeight: '600', color: colors.black, marginBottom: 8 },
  aiTag: { backgroundColor: colors.aiTag + '20', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginBottom: 16 },
  aiTagText: { fontSize: 13, color: colors.aiTag },
  section: { backgroundColor: colors.white, borderRadius: 16, padding: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 13, color: colors.stone, marginBottom: 10, fontWeight: '500' },
  body: { fontSize: 16, color: colors.black, lineHeight: 26 },
  emotion: { fontSize: 13, color: colors.stone, marginTop: 8 },
  tagPill: { backgroundColor: colors.warmLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', fontSize: 13, color: colors.warm, marginBottom: 8 },
  actionArea: { backgroundColor: colors.white, borderRadius: 16, padding: 20, marginTop: 8 },
  actionTitle: { fontSize: 17, fontWeight: '600', color: colors.black, marginBottom: 8 },
  actionHint: { fontSize: 14, color: colors.stone, marginBottom: 16 },
  actionBtn: { backgroundColor: colors.primaryLight, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  actionBtnDisabled: { backgroundColor: colors.stoneLight },
  recuseBtn: { backgroundColor: colors.warmLight },
  actionBtnText: { fontSize: 15, color: colors.primary, fontWeight: '500' },
  templateBtn: {
    backgroundColor: colors.warmLight,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.primaryMid,
  },
  templateBtnText: { fontSize: 14, color: colors.warm, fontWeight: '500' },
  textarea: { backgroundColor: colors.stoneLight, borderRadius: 12, padding: 14, fontSize: 15, color: colors.black, minHeight: 120, marginBottom: 14 },
  smallInput: { backgroundColor: colors.stoneLight, borderRadius: 12, padding: 14, fontSize: 15, color: colors.black, marginBottom: 14 },
  formTitle: { fontSize: 24, fontWeight: '700', color: colors.black, marginBottom: 24 },
  label: { fontSize: 13, color: colors.stone, marginBottom: 8, marginTop: 16 },
  charWarnInline: { color: colors.warning, fontWeight: '500' },
  multiSelectRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  memberChip: { backgroundColor: colors.stoneLight, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10 },
  memberChipSelected: { backgroundColor: colors.primaryLight, borderWidth: 1, borderColor: colors.primary },
  memberChipText: { fontSize: 15, color: colors.black },
  memberBtn: { backgroundColor: colors.stoneLight, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 8 },
  memberBtnSelected: { backgroundColor: colors.primaryLight, borderWidth: 1, borderColor: colors.primaryMid },
  memberBtnText: { fontSize: 15, color: colors.black },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  categoryBtn: { backgroundColor: colors.stoneLight, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  categoryBtnSelected: { backgroundColor: colors.primaryLight, borderWidth: 1, borderColor: colors.primaryMid },
  categoryBtnText: { fontSize: 14, color: colors.black },
  // Statement textarea + mic button container
  textareaWrapper: { position: 'relative', marginBottom: 4 },
  micBtn: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primaryMid,
  },
  micIcon: { fontSize: 18 },
  submitBtn: { backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
  submitBtnText: { color: colors.white, fontSize: 17, fontWeight: '600' },
  // Party name in multi-defendant
  partyName: { fontSize: 13, color: colors.primary, fontWeight: '600', marginBottom: 6 },
  // Inquiry display
  inquiryItem: { marginBottom: 4 },
  inquiryLabel: { fontSize: 12, color: colors.warm, fontWeight: '600', marginBottom: 4 },
  inquiryQuestion: { fontSize: 15, color: colors.black, lineHeight: 22, marginBottom: 4 },
  inquiryAnswer: { fontSize: 15, color: colors.primary, lineHeight: 22 },
  inquiryPending: { fontSize: 13, color: colors.stone, fontStyle: 'italic' },
  // Judge inquiry form
  inquiryTargetRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  inquiryTargetBtn: { flex: 1, backgroundColor: colors.stoneLight, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  inquiryTargetBtnActive: { backgroundColor: colors.primaryLight, borderWidth: 1, borderColor: colors.primary },
  inquiryTargetText: { fontSize: 14, color: colors.black },
});
