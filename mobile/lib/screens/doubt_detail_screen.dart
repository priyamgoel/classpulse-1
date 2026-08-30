import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import '../services/auth_service.dart';
import '../theme/tokens.dart';

class DoubtDetailScreen extends StatefulWidget {
  final String doubtId;

  const DoubtDetailScreen({super.key, required this.doubtId});

  @override
  State<DoubtDetailScreen> createState() => _DoubtDetailScreenState();
}

class _DoubtDetailScreenState extends State<DoubtDetailScreen> {
  Map<String, dynamic>? _post;
  List<dynamic> _replies = [];
  bool _isLoading = true;
  String? _errorMessage;

  final _replyController = TextEditingController();
  bool _replyAnonymous = false;
  bool _isSubmittingReply = false;

  @override
  void initState() {
    super.initState();
    _fetchDoubtDetails();
  }

  @override
  void dispose() {
    _replyController.dispose();
    super.dispose();
  }

  Future<void> _fetchDoubtDetails() async {
    setState(() => _isLoading = true);
    try {
      final token = AuthService.token;
      final res = await http.get(
        Uri.parse('${AuthService.baseUrl}/doubts/${widget.doubtId}'),
        headers: {'Authorization': 'Bearer $token'},
      );

      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        setState(() {
          _post = data['post'];
          _replies = data['replies'] ?? [];
          _isLoading = false;
        });
      } else {
        setState(() {
          _errorMessage = 'Failed to load doubt thread.';
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'Network error loading discussion.';
        _isLoading = false;
      });
    }
  }

  Future<void> _togglePostHelpful() async {
    if (_post == null) return;
    try {
      final token = AuthService.token;
      final res = await http.post(
        Uri.parse('${AuthService.baseUrl}/doubts/helpful'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'target_type': 'POST',
          'target_id': _post!['id'],
        }),
      );

      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        setState(() {
          _post!['user_has_marked_helpful'] = data['marked'];
          _post!['helpful_count'] = data['helpful_count'];
        });
      }
    } catch (_) {}
  }

  Future<void> _toggleReplyHelpful(String replyId) async {
    try {
      final token = AuthService.token;
      final res = await http.post(
        Uri.parse('${AuthService.baseUrl}/doubts/helpful'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'target_type': 'REPLY',
          'target_id': replyId,
        }),
      );

      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        setState(() {
          final idx = _replies.indexWhere((r) => r['id'] == replyId);
          if (idx != -1) {
            _replies[idx]['user_has_marked_helpful'] = data['marked'];
            _replies[idx]['helpful_count'] = data['helpful_count'];
          }
        });
      }
    } catch (_) {}
  }

  Future<void> _acceptSolution(String replyId) async {
    try {
      final token = AuthService.token;
      final res = await http.post(
        Uri.parse('${AuthService.baseUrl}/doubts/replies/$replyId/accept-solution'),
        headers: {'Authorization': 'Bearer $token'},
      );

      if (res.statusCode == 200) {
        _fetchDoubtDetails();
      }
    } catch (_) {}
  }

  Future<void> _submitReply() async {
    final body = _replyController.text.trim();
    if (body.isEmpty || _post == null) return;

    setState(() => _isSubmittingReply = true);
    try {
      final token = AuthService.token;
      final res = await http.post(
        Uri.parse('${AuthService.baseUrl}/doubts/${_post!['id']}/replies'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'body': body,
          'is_anonymous': _replyAnonymous,
        }),
      );

      if (res.statusCode == 201) {
        _replyController.clear();
        setState(() {
          _replyAnonymous = false;
          _isSubmittingReply = false;
        });
        _fetchDoubtDetails();
      } else {
        setState(() => _isSubmittingReply = false);
      }
    } catch (_) {
      setState(() => _isSubmittingReply = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: M3Tokens.surface,
      appBar: AppBar(
        title: const Text('Discussion Thread', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _fetchDoubtDetails,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _post == null
              ? Center(child: Text(_errorMessage ?? 'Doubt not found'))
              : SafeArea(
                  child: Column(
                    children: [
                      Expanded(
                        child: SingleChildScrollView(
                          padding: const EdgeInsets.all(16.0),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              // Main Question Card
                              _buildPostCard(),
                              const SizedBox(height: 20),

                              // Replies Header
                              Text(
                                '${_replies.length} ${_replies.length == 1 ? 'Answer' : 'Answers & Solutions'}',
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                              ),
                              const SizedBox(height: 12),

                              // Replies List
                              ..._replies.map((r) => _buildReplyCard(r)),
                            ],
                          ),
                        ),
                      ),

                      // Reply Input Composer Bar
                      _buildReplyComposer(),
                    ],
                  ),
                ),
    );
  }

  Widget _buildPostCard() {
    final p = _post!;
    final isResolved = p['status'] == 'RESOLVED';
    final hasMarked = p['user_has_marked_helpful'] == true;
    final isAnonymous = p['is_anonymous'] == true;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(M3Tokens.shapeLarge),
        border: Border.all(color: isResolved ? Colors.green : M3Tokens.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Badges row
          Row(
            children: [
              if (isResolved)
                Container(
                  margin: const EdgeInsets.only(right: 6),
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: Colors.green.shade50,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: const Text('SOLVED', style: TextStyle(color: Colors.green, fontWeight: FontWeight.bold, fontSize: 10)),
                ),
              Container(
                margin: const EdgeInsets.only(right: 6),
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: M3Tokens.primaryContainer,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  p['audience_scope'] ?? 'CLASSROOM',
                  style: const TextStyle(color: M3Tokens.onPrimaryContainer, fontWeight: FontWeight.bold, fontSize: 10),
                ),
              ),
              if (p['topic_name'] != null)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: Colors.grey.shade100,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    p['topic_name'],
                    style: const TextStyle(color: M3Tokens.onSurfaceVariant, fontWeight: FontWeight.w600, fontSize: 10),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),

          // Title
          Text(
            p['title'] ?? '',
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: M3Tokens.onSurface),
          ),
          const SizedBox(height: 10),

          // Body
          Text(
            p['body'] ?? '',
            style: const TextStyle(fontSize: 14, height: 1.5, color: M3Tokens.onSurface),
          ),
          const SizedBox(height: 16),
          const Divider(height: 1),
          const SizedBox(height: 12),

          // Author & Helpful Action
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  CircleAvatar(
                    radius: 14,
                    backgroundColor: isAnonymous ? Colors.purple.shade100 : M3Tokens.primaryContainer,
                    child: Icon(
                      isAnonymous ? Icons.masks_outlined : Icons.person_outline,
                      size: 16,
                      color: isAnonymous ? Colors.purple : M3Tokens.primary,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    p['author_display_name'] ?? 'Peer',
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                  ),
                ],
              ),

              OutlinedButton.icon(
                onPressed: _togglePostHelpful,
                icon: Icon(hasMarked ? Icons.thumb_up : Icons.thumb_up_outlined, size: 14),
                label: Text('Helpful (${p['helpful_count'] ?? 0})', style: const TextStyle(fontSize: 12)),
                style: OutlinedButton.styleFrom(
                  backgroundColor: hasMarked ? M3Tokens.primaryContainer : null,
                  foregroundColor: hasMarked ? M3Tokens.primary : null,
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildReplyCard(Map<String, dynamic> r) {
    final isSolution = r['is_solution'] == true;
    final isEndorsed = r['is_teacher_endorsed'] == true;
    final hasMarked = r['user_has_marked_helpful'] == true;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isSolution ? Colors.green.shade50 : Colors.white,
        borderRadius: BorderRadius.circular(M3Tokens.shapeMedium),
        border: Border.all(color: isSolution ? Colors.green : M3Tokens.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Badges
          if (isSolution || isEndorsed)
            Row(
              children: [
                if (isSolution)
                  Container(
                    margin: const EdgeInsets.only(right: 6),
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: Colors.green,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.check, size: 12, color: Colors.white),
                        SizedBox(width: 2),
                        Text('ACCEPTED SOLUTION', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 9)),
                      ],
                    ),
                  ),
                if (isEndorsed)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: M3Tokens.primary,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.verified, size: 12, color: Colors.white),
                        SizedBox(width: 2),
                        Text('INSTRUCTOR ENDORSED', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 9)),
                      ],
                    ),
                  ),
              ],
            ),
          if (isSolution || isEndorsed) const SizedBox(height: 8),

          Text(
            r['body'] ?? '',
            style: const TextStyle(fontSize: 13, height: 1.45, color: M3Tokens.onSurface),
          ),
          const SizedBox(height: 12),
          const Divider(height: 1),
          const SizedBox(height: 8),

          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                r['author_display_name'] ?? 'Peer',
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11, color: M3Tokens.onSurfaceVariant),
              ),

              Row(
                children: [
                  TextButton(
                    onPressed: () => _acceptSolution(r['id']),
                    style: TextButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      minimumSize: Size.zero,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                    child: Text(
                      isSolution ? 'Unmark Solution' : 'Accept Solution',
                      style: TextStyle(color: isSolution ? Colors.green : M3Tokens.primary, fontSize: 11, fontWeight: FontWeight.bold),
                    ),
                  ),
                  const SizedBox(width: 8),
                  InkWell(
                    onTap: () => _toggleReplyHelpful(r['id']),
                    child: Row(
                      children: [
                        Icon(
                          hasMarked ? Icons.thumb_up : Icons.thumb_up_outlined,
                          size: 14,
                          color: hasMarked ? M3Tokens.primary : M3Tokens.onSurfaceVariant,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          '${r['helpful_count'] ?? 0}',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: hasMarked ? M3Tokens.primary : M3Tokens.onSurfaceVariant,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildReplyComposer() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: M3Tokens.outlineVariant)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _replyController,
                  decoration: const InputDecoration(
                    hintText: 'Type your answer or solution...',
                    border: InputBorder.none,
                    isDense: true,
                  ),
                ),
              ),
              IconButton(
                icon: _isSubmittingReply
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.send, color: M3Tokens.primary),
                onPressed: _isSubmittingReply ? null : _submitReply,
              ),
            ],
          ),
          Row(
            children: [
              Switch(
                value: _replyAnonymous,
                onChanged: (val) => setState(() => _replyAnonymous = val),
              ),
              const Text('Reply with Pseudonym', style: TextStyle(fontSize: 11, color: M3Tokens.onSurfaceVariant)),
            ],
          ),
        ],
      ),
    );
  }
}
