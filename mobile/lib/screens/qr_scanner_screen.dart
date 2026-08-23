import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:mobile_scanner/mobile_scanner.dart';
import '../services/auth_service.dart';
import '../theme/tokens.dart';

class QrScannerScreen extends StatefulWidget {
  const QrScannerScreen({super.key});

  @override
  State<QrScannerScreen> createState() => _QrScannerScreenState();
}

class _QrScannerScreenState extends State<QrScannerScreen> {
  final MobileScannerController _cameraController = MobileScannerController(
    detectionSpeed: DetectionSpeed.unrestricted,
  );

  // Multi-frame buffer: batchId -> Map<seq_idx, tokenPayload>
  String? _activeBatchId;
  String? _activeSessionId;
  String? _scanStartedAt;
  final Map<int, Map<String, dynamic>> _frameBuffer = {};

  bool _isSubmitting = false;
  bool _isCompleted = false;
  double _currentZoomFactor = 1.0; // 1x, 2x, 3x

  @override
  void dispose() {
    _cameraController.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    if (_isSubmitting || _isCompleted) return;

    for (final barcode in capture.barcodes) {
      final rawValue = barcode.rawValue;
      if (rawValue == null || rawValue.isEmpty) continue;

      try {
        final data = jsonDecode(rawValue);
        if (data is Map<String, dynamic>) {
          // Support both low-density compact format ({s, b, i, t, k, h}) and standard format
          final sessionId = (data['session_id'] ?? data['s'])?.toString();
          final batchId = (data['batch_id'] ?? data['b'])?.toString();
          final seqIdxRaw = data['seq_idx'] ?? data['i'];
          final hash = (data['hash'] ?? data['h'])?.toString();
          final timestamp = data['timestamp'] ?? data['t'];
          final tokenId = (data['token_id'] ?? data['k'])?.toString() ?? '';

          if (sessionId != null && batchId != null && seqIdxRaw != null && hash != null) {
            final normalized = {
              'session_id': sessionId,
              'batch_id': batchId,
              'seq_idx': (seqIdxRaw as num).toInt(),
              'timestamp': timestamp,
              'token_id': tokenId,
              'hash': hash,
            };
            _processDecodedToken(normalized);
            break;
          }
        }
      } catch (_) {
        // Ignore non-matching barcodes
      }
    }
  }

  void _processDecodedToken(Map<String, dynamic> token) {
    final String batchId = token['batch_id']?.toString() ?? '';
    final String sessionId = token['session_id']?.toString() ?? '';
    final int seqIdx = (token['seq_idx'] as num).toInt();

    if (batchId.isEmpty || sessionId.isEmpty) return;

    setState(() {
      // If a new batch is detected, reset sequence buffer & record scan start timestamp
      if (_activeBatchId != batchId) {
        _activeBatchId = batchId;
        _activeSessionId = sessionId;
        _scanStartedAt = DateTime.now().toUtc().toIso8601String();
        _frameBuffer.clear();
      }

      _frameBuffer[seqIdx] = token;
    });

    // Check if we have collected all 3 frames: [0, 1, 2]
    if (_frameBuffer.containsKey(0) &&
        _frameBuffer.containsKey(1) &&
        _frameBuffer.containsKey(2)) {
      _submitAttendanceSequence();
    }
  }

  Future<void> _submitAttendanceSequence() async {
    if (_isSubmitting || _isCompleted) return;

    setState(() {
      _isSubmitting = true;
    });

    _cameraController.stop();

    final tokenList = [
      _frameBuffer[0]!,
      _frameBuffer[1]!,
      _frameBuffer[2]!,
    ];

    try {
      final token = AuthService.token;
      final response = await http.post(
        Uri.parse('${AuthService.baseUrl}/attendance/scan'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'session_id': _activeSessionId,
          'tokens': tokenList,
          'scan_started_at': _scanStartedAt,
        }),
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 200) {
        setState(() {
          _isCompleted = true;
        });
        if (mounted) {
          _showSuccessDialog(data['acl_ms'] ?? 0);
        }
      } else {
        if (mounted) {
          _showErrorDialog(data['error'] ?? 'Attendance validation failed');
        }
      }
    } catch (e) {
      if (mounted) {
        _showErrorDialog('Network error connecting to backend: $e');
      }
    } finally {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
        });
      }
    }
  }

  void _showSuccessDialog(int aclMs) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(M3Tokens.shapeLarge)),
        backgroundColor: M3Tokens.surface,
        title: const Row(
          children: [
            Icon(Icons.check_circle, color: Colors.green, size: 28),
            SizedBox(width: 10),
            Text('Marked PRESENT!', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Your multi-frame QR sequence was verified and recorded on the live session roster.',
              style: TextStyle(fontSize: 14, color: M3Tokens.onSurface),
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: M3Tokens.secondaryContainer,
                borderRadius: BorderRadius.circular(M3Tokens.shapeSmall),
              ),
              child: Row(
                children: [
                  const Icon(Icons.flash_on, size: 18, color: M3Tokens.onSecondaryContainer),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Capture Latency (ACL): ${aclMs}ms',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: M3Tokens.onSecondaryContainer),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          FilledButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              Navigator.of(context).pop(true); // Return success to home screen
            },
            child: const Text('Done'),
          ),
        ],
      ),
    );
  }

  void _showErrorDialog(String message) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(M3Tokens.shapeLarge)),
        backgroundColor: M3Tokens.surface,
        title: const Row(
          children: [
            Icon(Icons.error_outline, color: M3Tokens.error, size: 28),
            SizedBox(width: 10),
            Text('Scan Not Recorded', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
          ],
        ),
        content: Text(
          message,
          style: const TextStyle(fontSize: 14, color: M3Tokens.onSurface),
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              Navigator.of(context).pop();
            },
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              setState(() {
                _frameBuffer.clear();
                _activeBatchId = null;
                _isSubmitting = false;
                _isCompleted = false;
              });
              _cameraController.start();
            },
            child: const Text('Try Again'),
          ),
        ],
      ),
    );
  }

  void _setZoomLevel(double factor) {
    setState(() {
      _currentZoomFactor = factor;
    });
    // Map 1x -> 0.0, 2x -> 0.4, 3x -> 0.8 scale on MobileScanner
    final scale = factor == 1.0 ? 0.0 : (factor == 2.0 ? 0.4 : 0.8);
    try {
      _cameraController.setZoomScale(scale);
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        iconTheme: const IconThemeData(color: Colors.white),
        title: const Text(
          'Multi-Frame QR Scanner',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.flash_on, color: Colors.white),
            onPressed: () => _cameraController.toggleTorch(),
            tooltip: 'Toggle Flash',
          ),
          IconButton(
            icon: const Icon(Icons.cameraswitch, color: Colors.white),
            onPressed: () => _cameraController.switchCamera(),
            tooltip: 'Switch Camera',
          ),
        ],
      ),
      body: Stack(
        children: [
          // 1. Live Camera Viewfinder
          MobileScanner(
            controller: _cameraController,
            onDetect: _onDetect,
          ),

          // 2. Viewfinder Target Overlay
          Center(
            child: Container(
              width: 270,
              height: 270,
              decoration: BoxDecoration(
                border: Border.all(color: M3Tokens.primary, width: 3),
                borderRadius: BorderRadius.circular(20),
              ),
            ),
          ),

          // 3. Quick Zoom Selector Floating Buttons (1x, 2x, 3x) for Back-Bench Scanning
          Positioned(
            top: 20,
            left: 0,
            right: 0,
            child: Center(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.65),
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: Colors.white24),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [1.0, 2.0, 3.0].map((zoom) {
                    final isSelected = _currentZoomFactor == zoom;
                    return GestureDetector(
                      onTap: () => _setZoomLevel(zoom),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                        decoration: BoxDecoration(
                          color: isSelected ? M3Tokens.primary : Colors.transparent,
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          '${zoom.toInt()}x',
                          style: TextStyle(
                            color: Colors.white,
                            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                            fontSize: 13,
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ),
            ),
          ),

          // 4. Bottom Instruction & Frame Capture HUD
          Positioned(
            bottom: 30,
            left: 20,
            right: 20,
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: M3Tokens.surface.withValues(alpha: 0.94),
                borderRadius: BorderRadius.circular(M3Tokens.shapeLarge),
                boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 10)],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text(
                    'Point camera at the rotating 3-QR stream on screen',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: M3Tokens.onSurface),
                  ),
                  const SizedBox(height: 12),

                  // 3-Frame Accumulator Status (Responsive flex width)
                  Row(
                    children: [0, 1, 2].map((idx) {
                      final hasFrame = _frameBuffer.containsKey(idx);
                      return Expanded(
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          margin: const EdgeInsets.symmetric(horizontal: 3),
                          padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
                          decoration: BoxDecoration(
                            color: hasFrame ? M3Tokens.primary : M3Tokens.surfaceVariant,
                            borderRadius: BorderRadius.circular(M3Tokens.shapeSmall),
                            border: Border.all(
                              color: hasFrame ? M3Tokens.primary : M3Tokens.outlineVariant,
                            ),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                hasFrame ? Icons.check_circle : Icons.radio_button_unchecked,
                                size: 13,
                                color: hasFrame ? Colors.white : M3Tokens.onSurfaceVariant,
                              ),
                              const SizedBox(width: 4),
                              Flexible(
                                child: Text(
                                  'Frame ${idx + 1}',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                    color: hasFrame ? Colors.white : M3Tokens.onSurfaceVariant,
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    }).toList(),
                  ),

                  if (_isSubmitting) ...[
                    const SizedBox(height: 14),
                    const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)),
                        SizedBox(width: 10),
                        Text('Validating cryptographic signatures...', style: TextStyle(fontSize: 12)),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
