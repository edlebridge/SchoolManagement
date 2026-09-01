import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MessageSquare, Send, Search, Check, CheckCheck, Users, CircleAlert as AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useParent } from '@/context/ParentContext';
import { useToast } from '@/context/ToastContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Form';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { RowSkeleton } from '@/components/ui/Spinner';
import { cn, relativeTime } from '@/lib/utils';
import type { AppUser, Message } from '@/types';

interface Contact {
  user: AppUser;
  lastMessage?: Message;
  unreadCount: number;
}

export function ParentMessages() {
  const { profile } = useAuth();
  const { children, selectedChild, selectedChildClass, loading, selectChild } = useParent();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [selectedContact, setSelectedContact] = useState<AppUser | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const [teacherContacts, setTeacherContacts] = useState<AppUser[]>([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [childMenuOpen, setChildMenuOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Step 1: Load teacher contacts for the selected child's class
  // Query class_subjects by child's class_id to get teacher_ids,
  // then query app_users by those teacher_ids to get teacher profiles.
  const loadTeacherContacts = useCallback(async () => {
    if (!selectedChild?.class_id || !profile?.school_id) {
      setTeacherContacts([]);
      setContactsLoading(false);
      return;
    }
    setContactsLoading(true);
    try {
      // Get class_subjects for this child's class to find teacher_ids
      const { data: classSubjects } = await supabase
        .from('class_subjects')
        .select('teacher_id')
        .eq('school_id', profile.school_id)
        .eq('class_id', selectedChild.class_id);

      const teacherIds = [...new Set(
        ((classSubjects ?? []) as { teacher_id: string | null }[])
          .map((cs) => cs.teacher_id)
          .filter((id): id is string => !!id)
      )];

      if (teacherIds.length === 0) {
        setTeacherContacts([]);
        setContactsLoading(false);
        return;
      }

      // Also include the class teacher if assigned
      if (selectedChildClass?.class_teacher_id) {
        teacherIds.push(selectedChildClass.class_teacher_id);
      }

      const uniqueTeacherIds = [...new Set(teacherIds)];

      // Get teacher profiles from app_users
      const { data: teachers } = await supabase
        .from('app_users')
        .select('*')
        .in('id', uniqueTeacherIds)
        .eq('active', true);

      // Filter out the current parent (in case they're somehow a teacher too)
      const teacherList = ((teachers as AppUser[]) ?? []).filter(
        (t) => t.user_id !== profile?.user_id
      );

      setTeacherContacts(teacherList);
    } catch {
      setTeacherContacts([]);
    } finally {
      setContactsLoading(false);
    }
  }, [selectedChild?.class_id, selectedChildClass?.class_teacher_id, profile?.school_id, profile?.user_id]);

  useEffect(() => {
    loadTeacherContacts();
    // Reset selected contact when child changes
    setSelectedContact(null);
  }, [loadTeacherContacts]);

  // Step 2: Load all messages involving this parent user
  const loadAllMessages = useCallback(async () => {
    if (!profile?.user_id) return;
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`sender_id.eq.${profile.user_id},recipient_id.eq.${profile.user_id}`)
      .order('created_at', { ascending: true });
    setAllMessages((data as Message[]) ?? []);
  }, [profile?.user_id]);

  useEffect(() => {
    loadAllMessages();
  }, [loadAllMessages]);

  // Step 3: Build contact list with last message and unread count
  // conversation_id = [sender_id, recipient_id].sort().join('|') using user_id values
  const contacts: Contact[] = useMemo(() => {
    if (!profile?.user_id) return [];
    return teacherContacts
      .map((user) => {
        const conversationId = [profile.user_id, user.user_id].sort().join('|');
        const conversationMessages = allMessages.filter(
          (m) => m.conversation_id === conversationId
        );
        const lastMessage = conversationMessages[conversationMessages.length - 1];
        const unreadCount = conversationMessages.filter(
          (m) => m.recipient_id === profile.user_id && !m.read_at
        ).length;
        return { user, lastMessage, unreadCount };
      })
      .filter((c) => {
        if (!search.trim()) return true;
        return c.user.full_name.toLowerCase().includes(search.toLowerCase());
      })
      .sort((a, b) => {
        const aTime = a.lastMessage?.created_at ?? '';
        const bTime = b.lastMessage?.created_at ?? '';
        return bTime.localeCompare(aTime);
      });
  }, [teacherContacts, allMessages, profile?.user_id, search]);

  // Step 4: Load conversation messages when contact selected
  const loadConversation = useCallback(async () => {
    if (!selectedContact || !profile?.user_id) return;
    const conversationId = [profile.user_id, selectedContact.user_id].sort().join('|');
    setMessagesLoading(true);
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    setMessages((data as Message[]) ?? []);
    setMessagesLoading(false);

    // Mark received messages as read
    const unreadIds = ((data as Message[]) ?? [])
      .filter((m) => m.recipient_id === profile.user_id && !m.read_at)
      .map((m) => m.id);

    if (unreadIds.length > 0) {
      const now = new Date().toISOString();
      await supabase
        .from('messages')
        .update({ read_at: now })
        .in('id', unreadIds);
      // Update local state
      setAllMessages((prev) =>
        prev.map((m) => (unreadIds.includes(m.id) ? { ...m, read_at: now } : m))
      );
      setMessages((prev) =>
        prev.map((m) => (unreadIds.includes(m.id) ? { ...m, read_at: now } : m))
      );
    }
  }, [selectedContact, profile?.user_id]);

  useEffect(() => {
    loadConversation();
  }, [loadConversation]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Step 5: Send message
  const handleSend = async () => {
    if (!newMessage.trim() || !selectedContact || !profile?.user_id || !profile?.school_id) return;
    setSending(true);
    try {
      const conversationId = [profile.user_id, selectedContact.user_id].sort().join('|');
      const payload = {
        school_id: profile.school_id,
        sender_id: profile.user_id,
        recipient_id: selectedContact.user_id,
        body: newMessage.trim(),
        conversation_id: conversationId,
        message_type: 'text',
        read_at: null,
      };

      const { data, error } = await supabase.from('messages').insert(payload).select().single();
      if (error) throw error;

      const newMsg = data as Message;
      setMessages((prev) => [...prev, newMsg]);
      setAllMessages((prev) => [...prev, newMsg]);
      setNewMessage('');

      // Notify the recipient (teacher)
      try {
        await supabase.from('notifications').insert({
          school_id: profile.school_id,
          user_id: selectedContact.user_id,
          type: 'message',
          title: `New message from ${profile?.full_name ?? 'Parent'}`,
          body: newMessage.trim().slice(0, 100),
          link: '/teacher/messages',
        });
      } catch {
        // Non-critical
      }

      toast('Message sent');
    } catch {
      toast('Failed to send message', 'error');
    } finally {
      setSending(false);
    }
  };

  // Step 6: Real-time subscription for new messages
  useEffect(() => {
    if (!profile?.user_id) return;
    const channel = supabase
      .channel('parent-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `recipient_id=eq.${profile.user_id}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setAllMessages((prev) => [...prev, newMsg]);
          // If in conversation with sender, add to messages and mark read
          if (selectedContact && newMsg.sender_id === selectedContact.user_id) {
            setMessages((prev) => [...prev, newMsg]);
            // Mark as read
            const now = new Date().toISOString();
            supabase
              .from('messages')
              .update({ read_at: now })
              .eq('id', newMsg.id)
              .then(() => {
                setAllMessages((prev) =>
                  prev.map((m) => (m.id === newMsg.id ? { ...m, read_at: now } : m))
                );
                setMessages((prev) =>
                  prev.map((m) => (m.id === newMsg.id ? { ...m, read_at: now } : m))
                );
              });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.user_id, selectedContact]);

  if (loading) {
    return (
      <div>
        <PageHeader title="Messages" subtitle="Chat with your child's teachers" icon={<MessageSquare className="h-5 w-5" />} />
        <Card>
          <RowSkeleton rows={6} />
        </Card>
      </div>
    );
  }

  if (children.length === 0) {
    return (
      <div>
        <PageHeader title="Messages" subtitle="Chat with your child's teachers" icon={<MessageSquare className="h-5 w-5" />} />
        <Card>
          <EmptyState
            title="No children linked"
            description="No student records are linked to your account. Please contact the school administrator."
            icon={<AlertCircle className="h-10 w-10" />}
          />
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Messages"
        subtitle="Chat with your child's teachers"
        icon={<MessageSquare className="h-5 w-5" />}
        action={
          children.length > 1 ? (
            <div className="relative">
              <button
                onClick={() => setChildMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                <Avatar name={selectedChild?.full_name ?? ''} src={selectedChild?.photo_url} size="xs" />
                <span className="max-w-[120px] truncate">{selectedChild?.full_name}</span>
              </button>
              {childMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setChildMenuOpen(false)} />
                  <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-slate-100 bg-white p-2 shadow-lg dark:border-slate-800 dark:bg-slate-900">
                    {children.map((child) => (
                      <button
                        key={child.id}
                        onClick={() => {
                          selectChild(child.id);
                          setChildMenuOpen(false);
                        }}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors',
                          selectedChild?.id === child.id
                            ? 'bg-primary-50 dark:bg-primary-500/15'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                        )}
                      >
                        <Avatar name={child.full_name} src={child.photo_url} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink dark:text-slate-100">{child.full_name}</p>
                          <p className="text-xs text-ink-muted">{child.admission_number}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : undefined
        }
      />

      {/* Child Info Banner */}
      {selectedChild && (
        <div className="mb-4 flex items-center gap-3 rounded-xl bg-primary-50 px-4 py-3 dark:bg-primary-500/10">
          <Avatar name={selectedChild.full_name} src={selectedChild.photo_url} size="sm" />
          <div>
            <p className="text-sm font-medium text-ink dark:text-slate-100">
              Showing teachers for: {selectedChild.full_name}
            </p>
            <p className="text-xs text-ink-muted">
              Class: {selectedChildClass?.name ?? 'No class assigned'}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Contact List */}
        <Card className="lg:col-span-1">
          <CardHeader
            title="Teachers"
            subtitle={`${contacts.length} contact${contacts.length !== 1 ? 's' : ''}`}
            action={<Users className="h-5 w-5 text-ink-muted" />}
          />

          {/* Search */}
          <Input
            placeholder="Search teachers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
          />

          {/* Contacts */}
          <div className="mt-4 max-h-[55vh] space-y-1 overflow-y-auto">
            {contactsLoading ? (
              <RowSkeleton rows={4} />
            ) : contacts.length === 0 ? (
              <EmptyState
                title="No teachers found"
                description={
                  !selectedChild?.class_id
                    ? 'Your child is not assigned to a class yet.'
                    : 'No teachers are assigned to your child\'s class yet. Please check back later.'
                }
                icon={<Users className="h-10 w-10" />}
              />
            ) : (
              contacts.map((contact) => (
                <button
                  key={contact.user.id}
                  onClick={() => setSelectedContact(contact.user)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors',
                    selectedContact?.id === contact.user.id
                      ? 'bg-primary-50 dark:bg-primary-500/15'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                  )}
                >
                  <Avatar name={contact.user.full_name} src={contact.user.avatar_url} size="sm" />
                  <div className="flex-1 overflow-hidden">
                    <div className="flex items-center justify-between">
                      <p className="truncate font-medium text-ink dark:text-slate-100">{contact.user.full_name}</p>
                      {contact.unreadCount > 0 && (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-600 px-1.5 text-xs font-semibold text-white">
                          {contact.unreadCount}
                        </span>
                      )}
                    </div>
                    {contact.lastMessage ? (
                      <p className="truncate text-xs text-ink-muted">
                        {contact.lastMessage.sender_id === profile?.user_id ? 'You: ' : ''}
                        {contact.lastMessage.body}
                      </p>
                    ) : (
                      <p className="text-xs text-ink-muted">No messages yet</p>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </Card>

        {/* Chat Panel */}
        <Card className="lg:col-span-2 flex flex-col">
          {!selectedContact ? (
            <div className="flex flex-1 items-center justify-center py-20">
              <EmptyState
                title="Select a teacher"
                description="Choose a teacher from the list to start chatting."
                icon={<MessageSquare className="h-10 w-10" />}
              />
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
                <Avatar name={selectedContact.full_name} src={selectedContact.avatar_url} size="md" />
                <div className="flex-1">
                  <p className="font-semibold text-ink dark:text-slate-100">{selectedContact.full_name}</p>
                  <p className="text-sm text-ink-muted">
                    {selectedContact.phone ?? 'No phone'} · Teacher
                  </p>
                </div>
                <Badge variant="primary">Teacher</Badge>
              </div>

              {/* Messages */}
              <div className="flex-1 space-y-3 overflow-y-auto py-4" style={{ maxHeight: '50vh' }}>
                {messagesLoading ? (
                  <RowSkeleton rows={4} />
                ) : messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center py-10">
                    <p className="text-sm text-ink-muted">No messages yet. Start the conversation!</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isSent = msg.sender_id === profile?.user_id;
                    const isRead = !!msg.read_at;
                    return (
                      <div
                        key={msg.id}
                        className={cn('flex', isSent ? 'justify-end' : 'justify-start')}
                      >
                        <div
                          className={cn(
                            'max-w-[75%] rounded-2xl px-4 py-2.5',
                            isSent
                              ? 'bg-primary-600 text-white'
                              : 'bg-slate-100 text-ink dark:bg-slate-800 dark:text-slate-100'
                          )}
                        >
                          <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                          <div className={cn('mt-1 flex items-center gap-1 text-xs', isSent ? 'text-primary-100' : 'text-ink-muted')}>
                            <span>{relativeTime(msg.created_at)}</span>
                            {isSent && (
                              isRead ? (
                                <CheckCheck className="h-3.5 w-3.5" />
                              ) : (
                                <Check className="h-3.5 w-3.5" />
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Send Message */}
              <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleSend}
                    loading={sending}
                    disabled={!newMessage.trim()}
                    leftIcon={<Send className="h-4 w-4" />}
                  >
                    Send
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
